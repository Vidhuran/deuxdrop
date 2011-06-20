/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Raindrop Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * (Remote) redis client.
 *
 * General data view mappings:
 * - Mailstore for users
 *   - User address book (peeps): [all, pinned] x [alphabetical, recency] of
 *      hash
 *   - Conversations: [all, by peep, pinned] x [recency] of hash+list
 *   - (Messages in conversations): [all, sent, received, in pinned] x [time] of
 *      some combo of blob/reference/metahash.
 * - Mailstore per-client stuff for users:
 *   - subscription: big blob? or big blob for major coverage plus lexicographic
 *      one-offs that should ideally cache well?
 * - Fanout server, per account
 *   - Live conversations:  [all live] x [conv id] of hash+list.
 **/

define(
  [
    'q',
    'redis',
    'rdcommon/log',
    'module',
    'exports'
  ],
  function(
    $Q,
    $redis,
    $log,
    $module,
    exports
  ) {

function RedisDbConn(connInfo, nsprefix, _logger) {
  this._conn = $redis.createClient(connInfo.port, connInfo.host);
  if (connInfo.password)
    this._conn.auth(connInfo.password);

  this._conn.on('ready', this._onReady.bind(this));
  this._conn.on('error', this._onError.bind(this));
  this._conn.on('end', this._onClosed.bind(this));

  this._log = LOGFAB.gendbConn(this, _logger, [connInfo.host, connInfo.port]);

  this._prefix = nsprefix;
}
RedisDbConn.prototype = {
  _onReady: function() {
    this._log.connected();
  },
  _onError: function(err) {
    this._log.error(err);
  },
  _onClosed: function() {
    this._log.closed();
  },

  //////////////////////////////////////////////////////////////////////////////
  // Hbase model
  //
  // Table/region/row/column family/column data-model where column families for
  //  a region cluster together with lexicographically ordered rows.  The level
  //  of atomicity is a single row.
  //
  // This should be used when:
  // - We believe we can generate long-term lexicographic clustering (things
  //    will be clustered on disk when fully merged) and/or temporal
  //    lexicographic clustering (things will be clustered in intermediary
  //    generations, including the memstore, because of write/read access
  //    patterns; this implies that we won't have to scan through all
  //    generations because of a bloom check/what not).
  // - We will not create undesirable disk hot-spotting.  Specifically, we want
  //    to avoid clustering seeks onto a spindle.  It's better to use a DHT
  //    model if we expect a request to result in a large number of seeks.

  defineHbaseTable: function(tableName, columnFamilies) {
  },

  getRowCell: function(tableName, rowId, columnName) {
    var deferred = $Q.defer();
    this._log.getRowCell(tableName, rowId, columnName);
    this._conn.hget(this._prefix + '_' + tableName + '_' + rowId, columnName,
                     function(err, result) {
      if (err)
        deferred.reject(err);
      else
        deferred.resolve(result);
    });
    return deferred.promise;
  },

  getRow: function(tableName, rowId, columnFamilies) {
    var deferred = $Q.defer();
    this._log.getRow(tableName, rowId, columnFamilies);
    this._conn.hgetall(this._prefix + '_' + tableName + '_' + rowId, columnName,
                     function(err, result) {
      if (err)
        deferred.reject(err);
      else
        deferred.resolve(result);
    });
    return deferred.promise;
  },

  putCells: function(tableName, rowId, cells) {
    var deferred = $Q.defer();
    this._log.putCells(tableName, rowId, cells);
    this._conn.hmset(this._prefix + '_' + tableName + '_' + rowId, cells,
                     function(err, replies) {
      if (err)
        deferred.reject(err);
      else
        deferred.resolve(null);
    });
    return deferred.promise;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Reorderable collection index model
  //
  // Support manually-updated ordered indices that name reference object
  //  identities (probably rows in the hbase model).  Semantics currently
  //  exactly correspond to the redis sorted set model, although there are ways
  //  to reflect this into hbase that will need analysis.  (We will likely use
  //  a naive stopgap for hbase initially.)

  defineReorderableIndex: function(tableName) {
  },
  /**
   * Scan index using the (ordered) values as our keypoints; although redis
   *  supports actual offsets, any hbase implementation would have serious
   *  difficulty with that model.  Because there could be multiple object
   *  names associated with a given value, object names can be provided to
   *  provide precise boundaries.  Passing null for a value tells us to use
   *  the relevant infinity.  Passing null for an object name means to use the
   *  relevant first/last value.
   */
  scanIndex: function(tableName, indexName,
                      lowValue, lowObjectName, lowInclusive,
                      highValue, highObjectName, highInclusive) {
  },

  /**
   * Update the value associated with an objectName for the given index for the
   *  given (index) table.
   */
  updateIndexValue: function(tableName, indexName, objectName, newValue,
                             oldValueIfKnown) {
    this._conn.zadd(this._prefix + '_' + tableName + '_' + indexName,
                    value, objectName);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Session Management

  close: function() {
    this._conn.quit();
  },

  //////////////////////////////////////////////////////////////////////////////
};
exports.DbConn = RedisDbConn;

const TEST_DB_OFFSET = 16;

/**
 * Create a test connection to a test database.
 *
 * XXX theory, not done, just using db 2 for now...
 * To ensure tests get their own
 *  little world to play in, we use the process pid as a uniqueifying
 *  constraint.  Callers are still required to provide a unique name to
 *  namespace this connection from other connections used by the same test but
 *  that want their own theoretical database.
 */
exports.makeTestDBConnection = function(uniqueName, _logger) {
  var conn = new RedisDbConn({host: '127.0.0.1', port: 6379}, uniqueName,
                             _logger);
  conn._conn.select(2); // TEST_DB_OFFSET + process.pid);
  conn._conn.flushdb();
  return conn;
};

exports.cleanupTestDBConnection = function(conn) {
  conn._conn.flushdb();
};


var LOGFAB = exports.LOGFAB = $log.register($module, {
  gendbConn: {
    //implClass: AuthClientConn,
    type: $log.CONNECTION,
    subtype: $log.CLIENT,
    semanticIdent: {
      host: 'host',
      port: 'port',
    },
    events: {
      connected: {},
      closed: {},

      getRowCell: {tableName: true, rowId: true, columnName: true},
      getRow: {tableName: true, rowId: true, columnFamilies: false},
      putCells: {tableName: true, rowId: true},
    },
    TEST_ONLY_events: {
      putCells: {cells: $log.JSONABLE},
    },
    errors: {
      error: {err: false},
    },
    LAYER_MAPPING: {
      layer: "db",
    },
  },
});

}); // end define
