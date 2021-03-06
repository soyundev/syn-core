synCore =
  Config: require( './lib/config' )
  device:
    network: require( './lib/device/network' )
  pubsub:
    Channel: require( './lib/pubsub/channel' )
    channel:
      factory: require( './lib/pubsub/channel-factory' )
  resource:
    Client: require( './lib/resource/client' )
    Url: require( './lib/resource/url' )
    interceptors:
      Handler: require( './lib/resource/interceptor/handler' ).InterceptorHandler
      TokenRefresher: require( './lib/resource/interceptor/token-refresher' )
  angularify: require( './lib/angularify' )
  i18n: require( './lib/i18n' ).i18n
  Messaging: require( './lib/messaging' ).default
  messaging:
    ui:
      Interface: require( './lib/messaging/ui/interface' ).default

if !!module
  module.exports = synCore
else
  window.syn ?= {}
  window.syn.core ?= synCore
