"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserData = exports.testPenalty = exports.checkSquatCompletion = exports.testAlarm = exports.checkAlarms = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
// Version: 2026-07-05-v12 (Timezone-aware alarms, localized notifications,
// robust alarm matching, default credentials, deleteUserData callable)
// X API configuration from environment
const xClientId = (0, params_1.defineString)("X_CLIENT_ID");
// API key for test-only HTTP endpoints (testAlarm / testPenalty)
const testApiKey = (0, params_1.defineString)("TEST_API_KEY");
/**
 * Verify the x-api-key header for test-only endpoints.
 * Rejects all requests when TEST_API_KEY is not configured.
 */
function isAuthorizedTestRequest(req) {
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
// Skip users whose alarm was already sent within this window (prevents
// double sends now that the time match covers a 2-minute window)
const ALARM_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
// Uses Application Default Credentials — the function's runtime service
// account (okiroya-9af3f@appspot.gserviceaccount.com) already has the
// required Firestore / FCM roles
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const WEEKDAY_TO_NUMBER = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};
/**
 * Get the local time ("HH:mm") and day of week (0 = Sunday) for a given
 * IANA timezone at the given instant. Falls back to Asia/Tokyo for
 * invalid/unknown timezones.
 */
function getLocalTimeAndDay(timezone, date) {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour12: false,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
        }).formatToParts(date);
        const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
        // Some ICU versions format midnight as "24" with hour12: false
        let hour = get("hour");
        if (hour === "24") {
            hour = "00";
        }
        return {
            time: `${hour}:${get("minute")}`,
            day: WEEKDAY_TO_NUMBER[get("weekday")] ?? 0,
        };
    }
    catch (error) {
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
async function sendAlarmNotification(fcmToken, userId, language) {
    const alarmMessage = ALARM_MESSAGES[language] ||
        ALARM_MESSAGES.ja;
    try {
        const message = {
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
                priority: "high",
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
    }
    catch (error) {
        console.error(`Error sending alarm to ${userId}:`, error);
        return false;
    }
}
/**
 * Scheduled function that runs every minute to check for alarms
 */
exports.checkAlarms = (0, scheduler_1.onSchedule)({
    schedule: "* * * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
}, async () => {
    const now = new Date();
    // Match against the current minute AND the previous minute so an alarm is
    // not missed when the scheduler runs late or skips a minute.
    // lastAlarmSentAt dedupe below prevents double sends.
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    console.log(`Checking alarms at ${now.toISOString()}`);
    try {
        const allUsersSnapshot = await db.collection("users").get();
        const sendPromises = [];
        for (const doc of allUsersSnapshot.docs) {
            const userId = doc.id;
            const userData = doc.data();
            const alarmTimeValue = userData.settings?.alarmTime;
            if (!alarmTimeValue) {
                continue;
            }
            // Evaluate the alarm in the user's own timezone (Problem 26)
            const timezone = userData.settings?.timezone || DEFAULT_TIMEZONE;
            const candidates = [
                getLocalTimeAndDay(timezone, now),
                getLocalTimeAndDay(timezone, oneMinuteAgo),
            ];
            const matched = candidates.find((c) => c.time === alarmTimeValue);
            if (!matched) {
                continue;
            }
            // Empty alarmDays means "every day" (same behavior as the client)
            const alarmDays = userData.settings?.alarmDays || [];
            const daysToCheck = alarmDays.length > 0 ? alarmDays : [0, 1, 2, 3, 4, 5, 6];
            if (!daysToCheck.includes(matched.day)) {
                console.log(`User ${userId}: Alarm not set for today (day ${matched.day})`);
                continue;
            }
            const fcmToken = userData.fcmToken;
            if (!fcmToken) {
                console.log(`User ${userId}: No FCM token found`);
                continue;
            }
            // Dedupe: skip if an alarm was already sent within the window
            const lastAlarmSentAt = userData.lastAlarmSentAt;
            if (lastAlarmSentAt) {
                const lastSent = lastAlarmSentAt.toMillis?.() || new Date(lastAlarmSentAt).getTime();
                if (now.getTime() - lastSent < ALARM_DEDUPE_WINDOW_MS) {
                    console.log(`User ${userId}: Alarm already sent recently, skipping`);
                    continue;
                }
            }
            console.log(`User ${userId}: Sending alarm (${alarmTimeValue} in ${timezone})`);
            const language = userData.settings?.language || "ja";
            const currentTime = alarmTimeValue;
            const currentDay = matched.day;
            const sendPromise = sendAlarmNotification(fcmToken, userId, language).then(async (success) => {
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
                        alarmFailedAt: null, // Reset failure status for the new alarm
                    });
                }
            });
            sendPromises.push(sendPromise);
        }
        await Promise.all(sendPromises);
        console.log("Alarm check completed");
    }
    catch (error) {
        console.error("Error checking alarms:", error);
        throw error;
    }
});
/**
 * HTTP endpoint for testing alarm notifications
 * Usage: POST /testAlarm with body: { "userId": "xxx" }
 */
exports.testAlarm = (0, https_1.onRequest)({
    region: "asia-northeast1",
    invoker: "public",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
}, async (req, res) => {
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
        }
        else {
            res.status(500).send("Failed to send alarm notification");
        }
    }
    catch (error) {
        console.error("Error in testAlarm:", error);
        res.status(500).send("Internal server error");
    }
});
/**
 * Refresh X access token using refresh token
 */
async function refreshXToken(refreshToken) {
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
        const tokens = await response.json();
        return { success: true, tokens };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: errorMessage };
    }
}
/**
 * Post a tweet using the X API v2
 */
async function postTweet(accessToken, text) {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: errorMessage };
    }
}
/**
 * Post penalty tweet for a user who failed to complete squats
 */
async function postPenaltyTweetForUser(userId, userData) {
    const xConnection = userData.snsConnections?.x;
    console.log(`User ${userId}: X connection status - connected: ${xConnection?.connected}, hasAccessToken: ${!!xConnection?.accessToken}, hasRefreshToken: ${!!xConnection?.refreshToken}`);
    if (!xConnection?.connected || !xConnection?.accessToken) {
        console.log(`User ${userId}: X not connected, skipping penalty post`);
        return false;
    }
    let accessToken = xConnection.accessToken;
    const refreshToken = xConnection.refreshToken;
    const language = userData.settings?.language || "ja";
    // Try to refresh token first (tokens may have expired)
    if (refreshToken) {
        console.log(`User ${userId}: Attempting to refresh X token...`);
        const refreshResult = await refreshXToken(refreshToken);
        if (refreshResult.success && refreshResult.tokens) {
            accessToken = refreshResult.tokens.access_token;
            // Update tokens in Firestore
            await db.collection("users").doc(userId).update({
                "snsConnections.x.accessToken": refreshResult.tokens.access_token,
                "snsConnections.x.refreshToken": refreshResult.tokens.refresh_token,
            });
            console.log(`User ${userId}: X tokens refreshed successfully`);
        }
        else {
            console.error(`User ${userId}: X token refresh failed: ${refreshResult.error}`);
        }
    }
    else {
        console.log(`User ${userId}: No refresh token available, using existing access token`);
    }
    // Get penalty message based on user's language
    const penaltyMessage = PENALTY_MESSAGES[language] ||
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
        // NOTE: Failure stats (stats.totalFailures / monthlyFailures) are recorded
        // by the client (recordWakeUpHistory) to avoid double counting.
        // penaltyPostedAt prevents duplicate penalty posts for the same alarm.
        await db.collection("users").doc(userId).update({
            penaltyPostedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    }
    else {
        console.error(`User ${userId}: Failed to post penalty tweet: ${postResult.error}`);
        return false;
    }
}
/**
 * Scheduled function that runs every minute to check for squat completion
 * If user hasn't completed squats within 5 minutes of alarm, post penalty tweet
 * Posts within ~1 minute of the 5-minute deadline
 */
exports.checkSquatCompletion = (0, scheduler_1.onSchedule)({
    schedule: "* * * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
}, async () => {
    const now = Date.now();
    // Users who had alarm sent 5+ minutes ago are eligible for penalty
    const fiveMinutesAgo = now - PENALTY_WINDOW_MS;
    // Limit to alarms sent within last 30 minutes to avoid processing old data
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    console.log(`Checking squat completion: alarms before ${new Date(fiveMinutesAgo).toISOString()}`);
    try {
        // Get all users
        const allUsersSnapshot = await db.collection("users").get();
        const penaltyPromises = [];
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
            const alarmTime = lastAlarmSentAt.toMillis?.() ||
                new Date(lastAlarmSentAt).getTime();
            // Skip if alarm is too old (more than 30 minutes)
            if (alarmTime < thirtyMinutesAgo) {
                continue;
            }
            // Client records alarmFailedAt when the 5-minute squat timer expires.
            // If present for this alarm, post the penalty immediately (no need to
            // wait for the 5-minute window on the server side)
            const failedForThisAlarm = (() => {
                if (!alarmFailedAt)
                    return false;
                const failedTime = alarmFailedAt.toMillis?.() || new Date(alarmFailedAt).getTime();
                return failedTime > alarmTime;
            })();
            // Skip if alarm is too recent (less than 5 minutes) and the client
            // has not reported a failure yet
            if (alarmTime > fiveMinutesAgo && !failedForThisAlarm) {
                continue;
            }
            // Check if squats were already completed after this alarm
            if (squatCompletedAt) {
                const completedTime = squatCompletedAt.toMillis?.() ||
                    new Date(squatCompletedAt).getTime();
                if (completedTime > alarmTime) {
                    console.log(`User ${userId}: Squats completed, skipping penalty`);
                    continue;
                }
            }
            // Check if penalty was already posted for this alarm
            if (penaltyPostedAt) {
                const penaltyTime = penaltyPostedAt.toMillis?.() ||
                    new Date(penaltyPostedAt).getTime();
                if (penaltyTime > alarmTime) {
                    console.log(`User ${userId}: Penalty already posted, skipping`);
                    continue;
                }
            }
            // User hasn't completed squats within 5 minutes - post penalty
            console.log(`User ${userId}: Squats not completed, posting penalty tweet`);
            const penaltyPromise = postPenaltyTweetForUser(userId, userData).then((success) => {
                if (!success) {
                    console.log(`User ${userId}: Penalty post failed or X not connected`);
                }
            });
            penaltyPromises.push(penaltyPromise);
        }
        await Promise.all(penaltyPromises);
        console.log("Squat completion check completed");
    }
    catch (error) {
        console.error("Error checking squat completion:", error);
        throw error;
    }
});
/**
 * HTTP endpoint for testing penalty post
 * Usage: POST /testPenalty with body: { "userId": "xxx" }
 */
exports.testPenalty = (0, https_1.onRequest)({
    region: "asia-northeast1",
    invoker: "public",
    serviceAccount: "okiroya-9af3f@appspot.gserviceaccount.com",
}, async (req, res) => {
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
        }
        else {
            res.status(500).send("Failed to post penalty tweet (X may not be connected)");
        }
    }
    catch (error) {
        console.error("Error in testPenalty:", error);
        res.status(500).send("Internal server error");
    }
});
/**
 * Deletes all Firestore data for the authenticated user (account deletion,
 * Problem 29). The Firebase Auth account itself is deleted client-side
 * immediately after this call succeeds.
 */
exports.deleteUserData = (0, https_1.onCall)({
    region: "asia-northeast1",
    invoker: "public",
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
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
    }
    catch (error) {
        console.error(`User ${uid}: Error deleting account data:`, error);
        throw new https_1.HttpsError("internal", "Failed to delete account data");
    }
});
//# sourceMappingURL=index.js.map