import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";

// Version: 2026-07-05-v12 (Timezone-aware alarms, localized notifications,
// robust alarm matching, default credentials, deleteUserData callable)

// X API configuration from environment
const xClientId = defineString("X_CLIENT_ID");

// API key for test-only HTTP endpoints (testAlarm / testPenalty)
const testApiKey = defineString("TEST_API_KEY");

/**
 * Verify the x-api-key header for test-only endpoints.
 * Rejects all requests when TEST_API_KEY is not configured.
 */
function isAuthorizedTestRequest(req: { headers: Record<string, unknown> }): boolean {
  const configuredKey = testApiKey.value();
  if (!configuredKey) {
    return false;
  }
  return req.headers["x-api-key"] === configuredKey;
}

// Penalty post window: 5 minutes in milliseconds
const PENALTY_WINDOW_MS = 5 * 60 * 1000;

// Penalty messages
const PENALTY_MESSAGES = {
  ja: "寝坊しました...\n私は決まった時間に起床することができず平気で寝過ごしてしまう愚かな人間です\n#オキロヤ",
  en: "I overslept...\nI am a foolish person who cannot wake up on time and easily oversleeps.\n#WakeOrShame",
};

// Alarm notification messages (localized by user's language setting)
const ALARM_MESSAGES = {
  ja: {
    title: "起床時間となりました",
    body: "アプリを開きスクワットを行ってください",
  },
  en: {
    title: "Time to wake up!",
    body: "Open the app and do your squats",
  },
};

// Fallback timezone for users who have not saved settings.timezone yet
const DEFAULT_TIMEZONE = "Asia/Tokyo";

// Alarm dedupe is keyed per occurrence (local date + alarm time) via
// lastAlarmOccurrence — see checkAlarms. A time-based window is NOT used:
// it blocked legitimate consecutive alarms set minutes apart (Problem 40).

// Uses Application Default Credentials — the function's runtime service
// account (okiroya-9af3f@appspot.gserviceaccount.com) already has the
// required Firestore / FCM roles
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Get the local time ("HH:mm"), day of week (0 = Sunday) and local date
 * ("YYYY-MM-DD") for a given IANA timezone at the given instant. Falls back
 * to Asia/Tokyo for invalid/unknown timezones. The dateKey is used to build
 * the per-occurrence alarm dedupe key (Problem 40).
 */
export function getLocalTimeAndDay(
  timezone: string,
  date: Date
): { time: string; day: number; dateKey: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);

    const get = (type: string): string =>
      parts.find((p) => p.type === type)?.value ?? "";

    // Some ICU versions format midnight as "24" with hour12: false
    let hour = get("hour");
    if (hour === "24") {
      hour = "00";
    }

    return {
      time: `${hour}:${get("minute")}`,
      day: WEEKDAY_TO_NUMBER[get("weekday")] ?? 0,
      dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    };
  } catch (error) {
    console.warn(`Invalid timezone "${timezone}", falling back to ${DEFAULT_TIMEZONE}`);
    return getLocalTimeAndDay(DEFAULT_TIMEZONE, date);
  }
}

/**
 * Send alarm notification to a user
 *
 * Uses APNs-specific payload for iOS (no top-level notification).
 * This ensures alert and sound are in the same aps object.
 */
async function sendAlarmNotification(
  fcmToken: string,
  userId: string,
  language: string
): Promise<boolean> {
  const alarmMessage =
    ALARM_MESSAGES[language as keyof typeof ALARM_MESSAGES] ||
    ALARM_MESSAGES.ja;

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      data: {
        type: "alarm",
        userId: userId,
        timestamp: new Date().toISOString(),
      },
      // iOS: APNs payload with alert and sound together
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: alarmMessage.title,
              body: alarmMessage.body,
            },
            sound: "alarm.caf",
            badge: 1,
            "interruption-level": "time-sensitive",
          },
        },
      },
      // Android: notification with sound
      android: {
        priority: "high" as const,
        notification: {
          title: alarmMessage.title,
          body: alarmMessage.body,
          sound: "default",
          channelId: "alarm-channel",
        },
      },
    };

    const response = await messaging.send(message);
    console.log(`Successfully sent alarm to ${userId}:`, response);
    return true;
  } catch (error) {
    console.error(`Error sending alarm to ${userId}:`, error);
    return false;
  }
}

/**
 * Scheduled function that runs every minute to check for alarms
 */
export const checkAlarms = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
  },
  async () => {
    const now = new Date();
    // Match against the current minute AND the previous minute so an alarm is
    // not missed when the scheduler runs late or skips a minute.
    // lastAlarmSentAt dedupe below prevents double sends.
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    console.log(`Checking alarms at ${now.toISOString()}`);

    try {
      const allUsersSnapshot = await db.collection("users").get();

      const sendPromises: Promise<void>[] = [];

      for (const doc of allUsersSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        const alarmTimeValue = userData.settings?.alarmTime;
        const fcmToken = userData.fcmToken;
        const language = userData.settings?.language || "ja";

        // ----- Pass 1: initial send for a newly matching occurrence -----
        let matched: { time: string; day: number; dateKey: string } | undefined;
        if (alarmTimeValue) {
          // Evaluate the alarm in the user's own timezone (Problem 26)
          const timezone = userData.settings?.timezone || DEFAULT_TIMEZONE;
          const candidates = [
            getLocalTimeAndDay(timezone, now),
            getLocalTimeAndDay(timezone, oneMinuteAgo),
          ];
          matched = candidates.find((c) => c.time === alarmTimeValue);

          if (matched) {
            // Empty alarmDays means "every day" (same behavior as the client)
            const alarmDays: number[] = userData.settings?.alarmDays || [];
            const daysToCheck =
              alarmDays.length > 0 ? alarmDays : [0, 1, 2, 3, 4, 5, 6];
            if (!daysToCheck.includes(matched.day)) {
              console.log(
                `User ${userId}: Alarm not set for today (day ${matched.day})`
              );
              matched = undefined;
            }
          }

          // Dedupe per alarm occurrence (local date + alarm time). The time
          // match spans a 2-minute window (current + previous minute), so the
          // same occurrence can match on two consecutive runs — but a *new*
          // occurrence (e.g. the user re-set the alarm a few minutes later)
          // must always fire (Problem 40). An already-sent occurrence falls
          // through to the re-alert pass below.
          if (matched) {
            const occurrenceKey = `${matched.dateKey} ${alarmTimeValue}`;
            if (userData.lastAlarmOccurrence === occurrenceKey) {
              console.log(
                `User ${userId}: Alarm already sent for ${occurrenceKey}`
              );
            } else if (!fcmToken) {
              console.log(`User ${userId}: No FCM token found`);
              continue;
            } else {
              console.log(
                `User ${userId}: Sending alarm (${alarmTimeValue} in ${timezone})`
              );

              const currentTime = alarmTimeValue;
              const currentDay = matched.day;

              // Record the occurrence BEFORE sending FCM: even if the push
              // fails (e.g. stale token), the alarm did occur, so the
              // client's window check and the penalty check must still
              // work (Problem 40).
              const sendPromise = db
                .collection("users")
                .doc(userId)
                .update({
                  lastAlarmOccurrence: occurrenceKey,
                  lastAlarmSentAt: admin.firestore.FieldValue.serverTimestamp(),
                  squatCompletedAt: null, // Reset squat completion status
                  alarmFailedAt: null, // Reset failure status for the new alarm
                  alarmAcknowledgedAt: null, // Reset ack for re-alerts (Problem 43)
                })
                .then(() => sendAlarmNotification(fcmToken, userId, language))
                .then(async (success) => {
                  if (success) {
                    // Record alarm history (delivery log — successful sends only)
                    await db.collection("alarmHistory").add({
                      userId: userId,
                      sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      alarmTime: currentTime,
                      dayOfWeek: currentDay,
                    });
                  }
                })
                .catch((error) => {
                  console.error(`User ${userId}: Error processing alarm:`, error);
                });

              sendPromises.push(sendPromise);
              continue;
            }
          }
        }

        // ----- Pass 2: re-alert until the squat screen is opened (Problem 43) -----
        // iOS plays a notification sound only once (max 30s), so "keep
        // ringing" is implemented by resending the alarm every cron run
        // while the 5-minute window is open and the user has not yet opened
        // the squat screen (alarmAcknowledgedAt), completed squats, or been
        // marked as failed. State is NOT updated here — notification only.
        if (!fcmToken) continue;
        const lastAlarmSentAt = userData.lastAlarmSentAt;
        if (!lastAlarmSentAt) continue;
        const lastSentMs =
          lastAlarmSentAt.toMillis?.() || new Date(lastAlarmSentAt).getTime();
        const elapsedMs = now.getTime() - lastSentMs;
        if (elapsedMs < 0 || elapsedMs > PENALTY_WINDOW_MS) continue;
        // These are reset to null on every initial send, so any value means
        // this occurrence was already handled
        if (userData.alarmAcknowledgedAt) continue;
        if (userData.squatCompletedAt) continue;
        if (userData.alarmFailedAt) continue;

        console.log(
          `User ${userId}: Re-alerting unacknowledged alarm ` +
            `(${Math.round(elapsedMs / 1000)}s elapsed)`
        );
        sendPromises.push(
          sendAlarmNotification(fcmToken, userId, language).then(() => undefined)
        );
      }

      await Promise.all(sendPromises);
      console.log("Alarm check completed");
    } catch (error) {
      console.error("Error checking alarms:", error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint for testing alarm notifications
 * Usage: POST /testAlarm with body: { "userId": "xxx" }
 */
export const testAlarm = onRequest(
  {
    region: "asia-northeast1",
    invoker: "public",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
  },
  async (req, res) => {
    if (!isAuthorizedTestRequest(req)) {
      res.status(403).send("Forbidden");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).send("userId is required");
      return;
    }

    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        res.status(404).send("User not found");
        return;
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        res.status(400).send("User has no FCM token");
        return;
      }

      const language = userData?.settings?.language || "ja";
      const success = await sendAlarmNotification(fcmToken, userId, language);

      if (success) {
        res.status(200).send("Alarm notification sent successfully");
      } else {
        res.status(500).send("Failed to send alarm notification");
      }
    } catch (error) {
      console.error("Error in testAlarm:", error);
      res.status(500).send("Internal server error");
    }
  }
);

// ===== X (Twitter) API Functions =====

interface XTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Refresh X access token using refresh token
 */
async function refreshXToken(
  refreshToken: string
): Promise<{ success: boolean; tokens?: XTokenResponse; error?: string }> {
  try {
    const clientId = xClientId.value();

    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);
    params.set("client_id", clientId);

    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error_description || "Token refresh failed",
      };
    }

    const tokens: XTokenResponse = await response.json();
    return { success: true, tokens };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Post a tweet using the X API v2
 */
async function postTweet(
  accessToken: string,
  text: string
): Promise<{ success: boolean; tweetId?: string; error?: string; status?: number }> {
  try {
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return {
      success: true,
      tweetId: data.data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Post penalty tweet for a user who failed to complete squats
 */
async function postPenaltyTweetForUser(
  userId: string,
  userData: admin.firestore.DocumentData
): Promise<boolean> {
  const xConnection = userData.snsConnections?.x;

  console.log(`User ${userId}: X connection status - connected: ${xConnection?.connected}, hasAccessToken: ${!!xConnection?.accessToken}, hasRefreshToken: ${!!xConnection?.refreshToken}`);

  if (!xConnection?.connected || !xConnection?.accessToken) {
    console.log(`User ${userId}: X not connected, skipping penalty post`);
    return false;
  }

  const refreshToken = xConnection.refreshToken;
  const language = userData.settings?.language || "ja";

  // Get penalty message based on user's language
  const penaltyMessage =
    PENALTY_MESSAGES[language as keyof typeof PENALTY_MESSAGES] ||
    PENALTY_MESSAGES.ja;

  // Try the stored access token first. X refresh tokens are single-use
  // (rotated on every refresh), so refreshing on every attempt risks
  // permanently breaking the rotation chain (Problem 41) — only refresh
  // when the access token is actually rejected (401).
  let postResult = await postTweet(xConnection.accessToken, penaltyMessage);

  if (!postResult.success && postResult.status === 401 && refreshToken) {
    console.log(`User ${userId}: Access token rejected, refreshing X token...`);
    const refreshResult = await refreshXToken(refreshToken);

    if (refreshResult.success && refreshResult.tokens) {
      // Persist the rotated tokens BEFORE using them: if this write failed
      // after posting, the new (single-use) refresh token would be lost
      // and the chain would break permanently.
      await db.collection("users").doc(userId).update({
        "snsConnections.x.accessToken": refreshResult.tokens.access_token,
        "snsConnections.x.refreshToken": refreshResult.tokens.refresh_token,
        "snsConnections.x.needsReauth": admin.firestore.FieldValue.delete(),
      });
      console.log(`User ${userId}: X tokens refreshed successfully`);

      postResult = await postTweet(refreshResult.tokens.access_token, penaltyMessage);
    } else {
      console.error(`User ${userId}: X token refresh failed: ${refreshResult.error}`);
      // The stored refresh token is dead — only an in-app X reconnect can
      // recover. Flag it so the client can prompt the user to re-connect.
      await db.collection("users").doc(userId).update({
        "snsConnections.x.needsReauth": true,
      });
      return false;
    }
  }

  if (postResult.success) {
    console.log(`User ${userId}: Penalty tweet posted successfully (${postResult.tweetId})`);

    // Record penalty post
    await db.collection("penaltyPosts").add({
      userId: userId,
      tweetId: postResult.tweetId,
      postedAt: admin.firestore.FieldValue.serverTimestamp(),
      alarmSentAt: userData.lastAlarmSentAt,
    });

    // NOTE: Failure stats (stats.totalFailures / monthlyFailures) are recorded
    // by the client (recordWakeUpHistory) to avoid double counting.
    // penaltyPostedAt prevents duplicate penalty posts for the same alarm.
    await db.collection("users").doc(userId).update({
      penaltyPostedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;
  } else {
    console.error(`User ${userId}: Failed to post penalty tweet: ${postResult.error}`);
    return false;
  }
}

/**
 * Scheduled function that runs every minute to check for squat completion
 * If user hasn't completed squats within 5 minutes of alarm, post penalty tweet
 * Posts within ~1 minute of the 5-minute deadline
 */
export const checkSquatCompletion = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
  },
  async () => {
    const now = Date.now();
    // Users who had alarm sent 5+ minutes ago are eligible for penalty
    const fiveMinutesAgo = now - PENALTY_WINDOW_MS;
    // Limit to alarms sent within last 30 minutes to avoid processing old data
    const thirtyMinutesAgo = now - 30 * 60 * 1000;

    console.log(`Checking squat completion: alarms before ${new Date(fiveMinutesAgo).toISOString()}`);

    try {
      // Get all users
      const allUsersSnapshot = await db.collection("users").get();

      const penaltyPromises: Promise<void>[] = [];

      for (const doc of allUsersSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        const lastAlarmSentAt = userData.lastAlarmSentAt;
        const squatCompletedAt = userData.squatCompletedAt;
        const penaltyPostedAt = userData.penaltyPostedAt;
        const alarmFailedAt = userData.alarmFailedAt;

        // Skip if no alarm was sent
        if (!lastAlarmSentAt) {
          continue;
        }

        // Convert Firestore timestamp to milliseconds
        const alarmTime =
          lastAlarmSentAt.toMillis?.() ||
          new Date(lastAlarmSentAt).getTime();

        // Skip if alarm is too old (more than 30 minutes)
        if (alarmTime < thirtyMinutesAgo) {
          continue;
        }

        // Client records alarmFailedAt when the 5-minute squat timer expires.
        // If present for this alarm, post the penalty immediately (no need to
        // wait for the 5-minute window on the server side)
        const failedForThisAlarm = (() => {
          if (!alarmFailedAt) return false;
          const failedTime =
            alarmFailedAt.toMillis?.() || new Date(alarmFailedAt).getTime();
          return failedTime > alarmTime;
        })();

        // Skip if alarm is too recent (less than 5 minutes) and the client
        // has not reported a failure yet
        if (alarmTime > fiveMinutesAgo && !failedForThisAlarm) {
          continue;
        }

        // Check if squats were already completed after this alarm
        if (squatCompletedAt) {
          const completedTime =
            squatCompletedAt.toMillis?.() ||
            new Date(squatCompletedAt).getTime();

          if (completedTime > alarmTime) {
            console.log(`User ${userId}: Squats completed, skipping penalty`);
            continue;
          }
        }

        // Check if penalty was already posted for this alarm
        if (penaltyPostedAt) {
          const penaltyTime =
            penaltyPostedAt.toMillis?.() ||
            new Date(penaltyPostedAt).getTime();

          if (penaltyTime > alarmTime) {
            console.log(`User ${userId}: Penalty already posted, skipping`);
            continue;
          }
        }

        // User hasn't completed squats within 5 minutes - post penalty
        console.log(`User ${userId}: Squats not completed, posting penalty tweet`);

        const penaltyPromise = postPenaltyTweetForUser(userId, userData).then(
          (success) => {
            if (!success) {
              console.log(`User ${userId}: Penalty post failed or X not connected`);
            }
          }
        );

        penaltyPromises.push(penaltyPromise);
      }

      await Promise.all(penaltyPromises);
      console.log("Squat completion check completed");
    } catch (error) {
      console.error("Error checking squat completion:", error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint for testing penalty post
 * Usage: POST /testPenalty with body: { "userId": "xxx" }
 */
export const testPenalty = onRequest(
  {
    region: "asia-northeast1",
    invoker: "public",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
  },
  async (req, res) => {
    if (!isAuthorizedTestRequest(req)) {
      res.status(403).send("Forbidden");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).send("userId is required");
      return;
    }

    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        res.status(404).send("User not found");
        return;
      }

      const userData = userDoc.data();
      if (!userData) {
        res.status(404).send("User data not found");
        return;
      }

      const success = await postPenaltyTweetForUser(userId, userData);

      if (success) {
        res.status(200).send("Penalty tweet posted successfully");
      } else {
        res.status(500).send("Failed to post penalty tweet (X may not be connected)");
      }
    } catch (error) {
      console.error("Error in testPenalty:", error);
      res.status(500).send("Internal server error");
    }
  }
);

/**
 * Deletes all Firestore data for the authenticated user (account deletion,
 * Problem 29). The Firebase Auth account itself is deleted client-side
 * immediately after this call succeeds.
 */
export const deleteUserData = onCall(
  {
    region: "asia-northeast1",
    invoker: "public",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    try {
      // Deletes the user document and all its subcollections (e.g. history)
      const userRef = db.collection("users").doc(uid);
      await db.recursiveDelete(userRef);

      // Delete this user's records in top-level collections
      const [alarmHistorySnapshot, penaltyPostsSnapshot] = await Promise.all([
        db.collection("alarmHistory").where("userId", "==", uid).get(),
        db.collection("penaltyPosts").where("userId", "==", uid).get(),
      ]);

      const batch = db.batch();
      alarmHistorySnapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
      penaltyPostsSnapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
      await batch.commit();

      console.log(`User ${uid}: account data deleted`);
      return { success: true };
    } catch (error) {
      console.error(`User ${uid}: Error deleting account data:`, error);
      throw new HttpsError("internal", "Failed to delete account data");
    }
  }
);
