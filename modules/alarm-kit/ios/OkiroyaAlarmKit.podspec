Pod::Spec.new do |s|
  s.name           = 'OkiroyaAlarmKit'
  s.version        = '1.0.0'
  s.summary        = 'AlarmKit bridge for Okiroya (Problem 56 / Phase 26.18 PoC)'
  s.description    = 'Schedules iOS 26+ AlarmKit alarms from JS. No-op on older iOS.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # アプリのデプロイターゲット(15.1)に合わせる。AlarmKit の処理は #available(iOS 26.0, *) で分岐する
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # iOS 26 未満の端末で起動時に落ちないよう弱リンクにする
  s.weak_frameworks = 'AlarmKit', 'ActivityKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
