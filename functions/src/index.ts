import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";

// Version: 2026-04-20-v10 (Reduce penalty post time lag to under 1 minute)
const serviceAccount = require("../serviceAccountKey.json");

// X API configuration from environment
const xClientId = defineString("X_CLIENT_ID");

// Penalty post window: 5 minutes in milliseconds
const PENALTY_WINDOW_MS = 5 * 60 * 1000;

// Penalty messages
const PENALTY_MESSAGES = {
  ja: "寝坊しました...\n私は決まった時間に起床することができず平気で寝過ごしてしまう愚かな人間です\n#オキロヤ",
  en: "I overslept...\nI am a foolish person who cannot wake up on time and easily oversleeps.\n#WakeOrShame",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "okiroya-9af3f",
});

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Get the current day of week (0 = Sunday, 1 = Monday, etc.)
 * Adjusted for Japan timezone (UTC+9)
 */
function getCurrentDayOfWeekJST(): number {
  const now = new Date();
  const jstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const jstMinutes = utcMinutes + jstOffset;

  let jstDate = new Date(now);
  if (jstMinutes >= 24 * 60) {
    jstDate.setUTCDate(jstDate.getUTCDate() + 1);
  }

  return jstDate.getUTCDay();
}

/**
 * Get current time in HH:mm format (Japan timezone)
 */
function getCurrentTimeJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  let jstMinutes = (utcMinutes + jstOffset) % (24 * 60);

  const hours = Math.floor(jstMinutes / 60);
  const minutes = jstMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Send alarm notification to a user
 *
 * Uses APNs-specific payload for iOS (no top-level notification).
 * This ensures alert and sound are in the same aps object.
 */
async function sendAlarmNotification(
  fcmToken: string,
  userId: string
): Promise<boolean> {
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
              title: "起床時間となりました",
              body: "アプリを開きスクワットを行ってください",
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
          title: "起床時間となりました",
          body: "アプリを開きスクワットを行ってください",
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
    const currentTime = getCurrentTimeJST();
    const currentDay = getCurrentDayOfWeekJST();

    console.log(`Checking alarms for time: ${currentTime}, day: ${currentDay}`);

    try {
      const allUsersSnapshot = await db.collection("users").get();

      const matchingUsers: { id: string; data: admin.firestore.DocumentData }[] = [];

      for (const doc of allUsersSnapshot.docs) {
        const data = doc.data();
        const alarmTimeValue = data.settings?.alarmTime;

        if (alarmTimeValue === currentTime) {
          matchingUsers.push({ id: doc.id, data });
        }
      }

      if (matchingUsers.length === 0) {
        console.log("No users found with alarm at this time");
        return;
      }

      console.log(`Found ${matchingUsers.length} users with alarm at ${currentTime}`);

      const sendPromises: Promise<void>[] = [];

      for (const user of matchingUsers) {
        const userData = user.data;
        const alarmDays = userData.settings?.alarmDays || [];
        const fcmToken = userData.fcmToken;
        const userId = user.id;

        if (!alarmDays.includes(currentDay)) {
          console.log(`User ${userId}: Alarm not set for today (day ${currentDay})`);
          continue;
        }

        if (!fcmToken) {
          console.log(`User ${userId}: No FCM token found`);
          continue;
        }

        const sendPromise = sendAlarmNotification(fcmToken, userId).then(
          async (success) => {
            if (success) {
              // Record alarm history
              await db.collection("alarmHistory").add({
                userId: userId,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                alarmTime: currentTime,
                dayOfWeek: currentDay,
              });
              // Record lastAlarmSentAt in user document for squat screen check
              await db.collection("users").doc(userId).update({
                lastAlarmSentAt: admin.firestore.FieldValue.serverTimestamp(),
                squatCompletedAt: null, // Reset squat completion status
              });
            }
          }
        );

        sendPromises.push(sendPromise);
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

      const success = await sendAlarmNotification(fcmToken, userId);

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
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
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

  if (!xConnection?.connected || !xConnection?.accessToken) {
    console.log(`User ${userId}: X not connected, skipping penalty post`);
    return false;
  }

  let accessToken = xConnection.accessToken;
  const refreshToken = xConnection.refreshToken;
  const language = userData.settings?.language || "ja";

  // Try to refresh token first (tokens may have expired)
  if (refreshToken) {
    const refreshResult = await refreshXToken(refreshToken);
    if (refreshResult.success && refreshResult.tokens) {
      accessToken = refreshResult.tokens.access_token;

      // Update tokens in Firestore
      await db.collection("users").doc(userId).update({
        "snsConnections.x.accessToken": refreshResult.tokens.access_token,
        "snsConnections.x.refreshToken": refreshResult.tokens.refresh_token,
      });

      console.log(`User ${userId}: X tokens refreshed`);
    }
  }

  // Get penalty message based on user's language
  const penaltyMessage =
    PENALTY_MESSAGES[language as keyof typeof PENALTY_MESSAGES] ||
    PENALTY_MESSAGES.ja;

  // Post penalty tweet
  const postResult = await postTweet(accessToken, penaltyMessage);

  if (postResult.success) {
    console.log(`User ${userId}: Penalty tweet posted successfully (${postResult.tweetId})`);

    // Record penalty post
    await db.collection("penaltyPosts").add({
      userId: userId,
      tweetId: postResult.tweetId,
      postedAt: admin.firestore.FieldValue.serverTimestamp(),
      alarmSentAt: userData.lastAlarmSentAt,
    });

    // Update user stats
    const currentMonth = new Date().toISOString().slice(0, 7);
    const stats = userData.stats || {};
    const isNewMonth = stats.currentMonth !== currentMonth;

    await db.collection("users").doc(userId).update({
      "stats.totalFailures": admin.firestore.FieldValue.increment(1),
      "stats.monthlyFailures": isNewMonth ? 1 : admin.firestore.FieldValue.increment(1),
      "stats.currentMonth": currentMonth,
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

        // Skip if no alarm was sent
        if (!lastAlarmSentAt) {
          continue;
        }

        // Convert Firestore timestamp to milliseconds
        const alarmTime =
          lastAlarmSentAt.toMillis?.() ||
          new Date(lastAlarmSentAt).getTime();

        // Skip if alarm is too old (more than 30 minutes) or too recent (less than 5 minutes)
        if (alarmTime < thirtyMinutesAgo || alarmTime > fiveMinutesAgo) {
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
