import AppIntents
import Foundation

/// AlarmKit の「停止」で止められた記録(Problem 56)。
/// 停止された時点ではアプリが起動していない(JS が動いていない)ことがあるため、
/// UserDefaults に溜めておき、アプリ起動後に JS から consumeStopEvents で取り出す
enum OkiroyaAlarmStopEventStore {
  static let didAppendNotification = Notification.Name("OkiroyaAlarmStopEventStore.didAppend")

  private static let key = "okiroya.alarmkit.stopEvents"

  static func append(alarmID: String) {
    let event: [String: Any] = [
      "alarmId": alarmID,
      "stoppedAt": Date().timeIntervalSince1970 * 1000,
    ]
    let defaults = UserDefaults.standard
    let events = (defaults.array(forKey: key) as? [[String: Any]]) ?? []
    defaults.set(events + [event], forKey: key)
    NotificationCenter.default.post(name: didAppendNotification, object: nil, userInfo: event)
  }

  static func consume() -> [[String: Any]] {
    let defaults = UserDefaults.standard
    let events = (defaults.array(forKey: key) as? [[String: Any]]) ?? []
    defaults.removeObject(forKey: key)
    return events
  }
}

/// 「停止」ボタンが押されたときに実行される Intent。
/// openAppWhenRun = true でアプリを開かせ、アプリ側でスクワット画面とループ音を続ける(Phase 26.18 の方針)
@available(iOS 26.0, *)
public struct OkiroyaAlarmStopIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "アラームを止める"
  public static var description = IntentDescription("オキロヤを開いてスクワットでアラームを止めます")
  public static var openAppWhenRun: Bool = true

  @Parameter(title: "alarmID")
  public var alarmID: String

  public init() {}

  public init(alarmID: String) {
    self.alarmID = alarmID
  }

  public func perform() async throws -> some IntentResult {
    OkiroyaAlarmStopEventStore.append(alarmID: alarmID)
    return .result()
  }
}
