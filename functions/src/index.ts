import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Get the current day of week (0 = Sunday, 1 = Monday, etc.)
 * Adjusted for Japan timezone (UTC+9)
 */
function getCurrentDayOfWeekJST(): number {
  const now = new Date();
  // Convert to Japan time
  const jstOffset = 9 * 60; // JST is UTC+9
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const jstMinutes = utcMinutes + jstOffset;

  // Adjust for day overflow
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
  // Convert to Japan time
  const jstOffset = 9 * 60; // JST is UTC+9
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
 */
async function sendAlarmNotification(
  fcmToken: string,
  userId: string
): Promise<boolean> {
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: "起床時間です！",
        body: "5分以内にスクワットを10回してください",
      },
      data: {
        type: "alarm",
        userId: userId,
        timestamp: new Date().toISOString(),
      },
      apns: {
        headers: {
          "apns-priority": "10", // High priority
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: "起床時間です！",
              body: "5分以内にスクワットを10回してください",
            },
            sound: "default",
            badge: 1,
            "content-available": 1,
            "interruption-level": "time-sensitive",
          },
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
 * This function queries Firestore for users whose alarm time matches the current time
 * and sends them a push notification
 */
export const checkAlarms = onSchedule(
  {
    schedule: "* * * * *", // Every minute
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async () => {
    const currentTime = getCurrentTimeJST();
    const currentDay = getCurrentDayOfWeekJST();

    console.log(
      `Checking alarms for time: ${currentTime}, day: ${currentDay}`
    );

    try {
      // Query users whose alarm time matches current time
      const usersSnapshot = await db
        .collection("users")
        .where("settings.alarmTime", "==", currentTime)
        .get();

      if (usersSnapshot.empty) {
        console.log("No users found with alarm at this time");
        return;
      }

      console.log(`Found ${usersSnapshot.size} users with alarm at ${currentTime}`);

      const sendPromises: Promise<void>[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const alarmDays = userData.settings?.alarmDays || [];
        const fcmToken = userData.fcmToken;

        // Check if alarm is set for current day of week
        if (!alarmDays.includes(currentDay)) {
          console.log(
            `User ${userDoc.id}: Alarm not set for today (day ${currentDay})`
          );
          continue;
        }

        // Check if user has FCM token
        if (!fcmToken) {
          console.log(`User ${userDoc.id}: No FCM token found`);
          continue;
        }

        // Send notification
        const sendPromise = sendAlarmNotification(fcmToken, userDoc.id).then(
          async (success) => {
            if (success) {
              // Record that alarm was sent (optional: for tracking)
              await db.collection("alarmHistory").add({
                userId: userDoc.id,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                alarmTime: currentTime,
                dayOfWeek: currentDay,
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
