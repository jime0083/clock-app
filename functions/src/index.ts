import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";

// Version: 2026-04-16-v8 (Change notification message, add lastAlarmSentAt)
const serviceAccount = require("../serviceAccountKey.json");

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
