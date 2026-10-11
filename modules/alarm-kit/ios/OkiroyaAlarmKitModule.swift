import ActivityKit
import AlarmKit
import AppIntents
import ExpoModulesCore
import SwiftUI

// MARK: - Records

struct ScheduleAlarmOptions: Record {
  /// 省略時は新しい UUID を振る
  @Field var id: String?
  /// 鳴らす日時(UNIX ミリ秒)
  @Field var epochMillis: Double = 0
  @Field var title: String = ""
  /// アプリのメインバンドル内の音ファイル名(例: "alarm.caf")。省略時はシステムの既定音
  @Field var soundName: String?
  /// 「停止」でアプリを開かせるか
  @Field var openAppOnStop: Bool = true
}

// MARK: - Exceptions

final class AlarmKitUnavailableException: Exception {
  override var reason: String {
    "AlarmKit is available on iOS 26.0 or later"
  }
}

final class InvalidAlarmOptionsException: GenericException<String> {
  override var reason: String {
    "Invalid alarm options: \(param)"
  }
}

final class AlarmScheduleFailedException: GenericException<String> {
  override var reason: String {
    "Failed to schedule alarm: \(param)"
  }
}

// MARK: - AlarmKit (iOS 26+)

@available(iOS 26.0, *)
struct OkiroyaAlarmMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
enum OkiroyaAlarmScheduler {
  // アプリのテーマカラー(src/constants/colors.ts の primary #3478F6)
  private static let tintColor = Color(red: 0x34 / 255, green: 0x78 / 255, blue: 0xF6 / 255)

  static func describe(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }

  static func describe(_ state: Alarm.State) -> String {
    switch state {
    case .scheduled: return "scheduled"
    case .countdown: return "countdown"
    case .paused: return "paused"
    case .alerting: return "alerting"
    @unknown default: return "unknown"
    }
  }

  static func schedule(
    id: UUID,
    date: Date,
    title: String,
    soundName: String?,
    openAppOnStop: Bool
  ) async throws {
    let alert: AlarmPresentation.Alert
    if #available(iOS 26.1, *) {
      // 26.1 以降は停止ボタンをシステムが出す(stopButton は廃止)
      alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title))
    } else {
      alert = AlarmPresentation.Alert(
        title: LocalizedStringResource(stringLiteral: title),
        stopButton: AlarmButton(text: "止める", textColor: .white, systemImageName: "stop.circle")
      )
    }

    let attributes = AlarmAttributes<OkiroyaAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: OkiroyaAlarmMetadata(),
      tintColor: tintColor
    )

    let sound: AlertConfiguration.AlertSound
    if let soundName, !soundName.isEmpty {
      sound = .named(soundName)
    } else {
      sound = .default
    }

    let stopIntent: (any LiveActivityIntent)? =
      openAppOnStop ? OkiroyaAlarmStopIntent(alarmID: id.uuidString) : nil

    let configuration = AlarmManager.AlarmConfiguration<OkiroyaAlarmMetadata>.alarm(
      schedule: .fixed(date),
      attributes: attributes,
      stopIntent: stopIntent,
      sound: sound
    )

    _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
  }
}

// MARK: - Module

/// AlarmKit の JS ブリッジ(Problem 56 / Phase 26.18 試作)。
/// iOS 26 未満では isAvailable() が false を返し、それ以外の呼び出しは AlarmKitUnavailableException になる
public class OkiroyaAlarmKitModule: Module {
  private var stopObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OkiroyaAlarmKit")

    Events("onAlarmStopped")

    OnStartObserving {
      self.stopObserver = NotificationCenter.default.addObserver(
        forName: OkiroyaAlarmStopEventStore.didAppendNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let event = notification.userInfo as? [String: Any] else { return }
        self?.sendEvent("onAlarmStopped", event)
      }
    }

    OnStopObserving {
      if let observer = self.stopObserver {
        NotificationCenter.default.removeObserver(observer)
        self.stopObserver = nil
      }
    }

    Function("isAvailable") { () -> Bool in
      if #available(iOS 26.0, *) {
        return true
      }
      return false
    }

    Function("getAuthorizationState") { () -> String in
      guard #available(iOS 26.0, *) else {
        return "unsupported"
      }
      return OkiroyaAlarmScheduler.describe(AlarmManager.shared.authorizationState)
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      guard #available(iOS 26.0, *) else {
        return "unsupported"
      }
      do {
        let state = try await AlarmManager.shared.requestAuthorization()
        return OkiroyaAlarmScheduler.describe(state)
      } catch {
        return OkiroyaAlarmScheduler.describe(AlarmManager.shared.authorizationState)
      }
    }

    AsyncFunction("scheduleAlarm") { (options: ScheduleAlarmOptions) async throws -> String in
      guard #available(iOS 26.0, *) else {
        throw AlarmKitUnavailableException()
      }

      let id: UUID
      if let rawId = options.id {
        guard let parsed = UUID(uuidString: rawId) else {
          throw InvalidAlarmOptionsException("id must be a UUID string")
        }
        id = parsed
      } else {
        id = UUID()
      }

      let date = Date(timeIntervalSince1970: options.epochMillis / 1000)
      guard date > Date() else {
        throw InvalidAlarmOptionsException("epochMillis must be in the future")
      }
      guard !options.title.isEmpty else {
        throw InvalidAlarmOptionsException("title must not be empty")
      }

      do {
        try await OkiroyaAlarmScheduler.schedule(
          id: id,
          date: date,
          title: options.title,
          soundName: options.soundName,
          openAppOnStop: options.openAppOnStop
        )
      } catch {
        throw AlarmScheduleFailedException(String(describing: error))
      }
      return id.uuidString
    }

    Function("cancelAlarm") { (rawId: String) throws in
      guard #available(iOS 26.0, *) else {
        throw AlarmKitUnavailableException()
      }
      guard let id = UUID(uuidString: rawId) else {
        throw InvalidAlarmOptionsException("id must be a UUID string")
      }
      try AlarmManager.shared.cancel(id: id)
    }

    /// 予約中・鳴動中の全アラームを取り消し、取り消した件数を返す
    Function("cancelAllAlarms") { () throws -> Int in
      guard #available(iOS 26.0, *) else {
        throw AlarmKitUnavailableException()
      }
      let alarms = try AlarmManager.shared.alarms
      for alarm in alarms {
        try AlarmManager.shared.cancel(id: alarm.id)
      }
      return alarms.count
    }

    Function("getAlarms") { () throws -> [[String: Any]] in
      guard #available(iOS 26.0, *) else {
        return []
      }
      return try AlarmManager.shared.alarms.map { alarm in
        ["id": alarm.id.uuidString, "state": OkiroyaAlarmScheduler.describe(alarm.state)]
      }
    }

    /// 「停止」で止められた記録を取り出す(取り出した記録は消える)
    Function("consumeStopEvents") { () -> [[String: Any]] in
      OkiroyaAlarmStopEventStore.consume()
    }
  }
}
