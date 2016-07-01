/**
 * Client request/response interceptor
**/
import pubsub from '../../../lib/pubsub/channel-factory'
import {
  ADD_CHANNEL as INTERCEPTOR_ADD,
  RESPONSE_METHOD as INTERCEPTOR_RESPONSE
} from './manager'

const MAX_ATTEMPTS = 2
const HTTP_SESSION_EXPIRED_CODE = 419

let tokenRefresherSingletonInstance = null

/**
 * Adds the necessary interceptor for 419 response codes.
 * Will try to refresh the token and retries the last request
 * if it's successfully refreshed
 * @param {Object} opts Configurable params
 * @param {?code} opts.status Http status code to be intercepted
 * @return {Promise}
**/
export function enable (opts = {}) {
  var tokenRefresher = new TokenRefresher(opts)
  if (tokenRefresher.isEnabled()) {
    return
  }
  tokenRefresher.enable()
  let interceptedStatus = opts.code || HTTP_SESSION_EXPIRED_CODE
  let eventPublisher = pubsub.create(INTERCEPTOR_ADD, ['add'])
  let interceptor = {}
  interceptor[INTERCEPTOR_RESPONSE] = function (req, resolve, reject, options) {
    // Session expired.
    if (req.status === interceptedStatus) {
      tokenRefresher.onSessionExpired(req, resolve, reject, options)
    } else {
      tokenRefresher.resetAttempts()
      return resolve(req)
    }
  }

  eventPublisher.add.publish(interceptor)
}

class TokenRefresher {

  /**
   * @param {Object} opts Options
   * @param {Function} opts.refreshRequestFn Request function to refresh the token
   * @param {?Function} opts.retryRequestFn Function to retry last failed request
   * the interceptor
  **/
  constructor (opts) {
    this.resetAttempts()
    if (tokenRefresherSingletonInstance) {
      return tokenRefresherSingletonInstance
    }

    if (!opts.refreshRequestFn) {
      return console.error('TokenRefresher@constructor: No refreshRequest function set')
    }

    this.refreshTokenRequest = opts.refreshRequestFn
    this.retryRequest = opts.retryRequestFn
    tokenRefresherSingletonInstance = this
  }

  _clearSession () {
    window.syn.auth.session.global.clear()
  }

  /**
   * Returns true if the user has checked the login's remember me checkbox
   * @returns {boolean}
  **/
  isStayLoggedInChecked () {
    let gSession = window.syn.auth.session.global.get()
    return !!gSession && gSession.stayLoggedIn()
  }

  resetAttempts () {
    this.attempts = 0
  }

  enable () {
    this._enabled = true
  }

  /**
   * @returns {boolean}
  **/
  isEnabled () {
    return this._enabled
  }

  /**
   * Saves the new token data into the current session
   * @param {Object} opts Options
   * @param {string} opts.token
   * @param {string} opts.refresh_token
   * @param {number} opts.expires_in
  **/
  updateToken (opts = {}) {
    if (!this.session) return
    this.session.token(opts.access_token)
    this.session.expiresIn(opts.expires_in)
    this.session.refreshToken(opts.refresh_token)
  }

  /**
   * Client API Callback for request retry
   * @param {Object} options
   * @return {Promise}
  **/
  retry (response) {
    if (!this.retryRequest) { return }
    if (!response.token) {
      this._clearSession()
      throw new Error('TokenRefresher: Error retrieving the new token')
    }
    this.updateToken(response.token)
    return this.retryRequest()
  }

  /**
   * Called once the session is expired.
   * Refreshes the token and retries last request.
   * Retries N times, session is cleared when N retries are done
   * but failed.
   * IMPORTANT: This function must always resolve or reject
   * @param {Object} req Request object
   * @param {Function} resolve Callback to resolve the promise
   * generated by the interceptor manager
   * @param {Function} reject Callback to reject the promise
   * generated by the interceptor manager
   * @returns {Object|Promise}
  **/
  onSessionExpired (req, resolve, reject) {
    this.attempts++
    if (this.attempts === MAX_ATTEMPTS) {
      this._clearSession()
      reject(new Error('TokenRefresher: Max. nr. of retries reached'))
    } else if (this.isStayLoggedInChecked()) {
      this.refreshTokenRequest()
      .then((refreshResponse) => {
        return this.retry(refreshResponse)
      })
      .catch(function (error) {
        reject(error)
      })
    } else {
      // Nothing has to be done
      resolve(req)
    }
  }
}
