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
exports.testAlarm = exports.checkAlarms = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
// Version: 2026-04-15-v7 (Use custom alarm.caf sound for iOS notification)
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
function getCurrentDayOfWeekJST() {
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
function getCurrentTimeJST() {
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
async function sendAlarmNotification(fcmToken, userId) {
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
                            title: "起床時間です！",
                            body: "5分以内にスクワットを10回してください",
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
                    title: "起床時間です！",
                    body: "5分以内にスクワットを10回してください",
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
    const currentTime = getCurrentTimeJST();
    const currentDay = getCurrentDayOfWeekJST();
    console.log(`Checking alarms for time: ${currentTime}, day: ${currentDay}`);
    try {
        const allUsersSnapshot = await db.collection("users").get();
        const matchingUsers = [];
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
        const sendPromises = [];
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
            const sendPromise = sendAlarmNotification(fcmToken, userId).then(async (success) => {
                if (success) {
                    await db.collection("alarmHistory").add({
                        userId: userId,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        alarmTime: currentTime,
                        dayOfWeek: currentDay,
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
//# sourceMappingURL=index.js.map