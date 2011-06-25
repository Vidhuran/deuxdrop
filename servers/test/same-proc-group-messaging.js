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
 * Loopback testing of the group messaging scenario using three clients.
 **/

define(
  [
    'rdcommon/testcontext',
    'rdservers/testhelper',
    'module',
    'exports'
  ],
  function(
    $tc,
    $th_rdservers,
    $module,
    exports
  ) {

var TD = exports.TD = $tc.defineTestsFor($module, null,
  [$th_rdservers.TESTHELPER], ['app']);

TD.DISABLED_commonCase('group messaging upgrade from one-on-one', function(T) {
  // clients are test helper entities that have convenience functions.
  var client_a = T.actor('client', 'A'),
      client_b = T.actor('client', 'B'),
      client_c = T.actor('client', 'C');
  // servers have no helpers because they never originate actions.
  var server_x = T.actor('combo', 'X'),
      server_y = T.actor('combo', 'Y'),
      server_z = T.actor('combo', 'Z');
  // (all of the above entities have their own initialization steps)
  // the messages in play...
  var conv = T.thing('conversation', 'conv'),
      msg_a1 = T.thing('message', 'a1'),
      msg_b1 = T.thing('message', 'b1'),
      msg_b2 = T.thing('message', 'b2'),
      join_msg = T.thing('message', 'join'),
      msg_c1 = T.thing('message', 'c1');

  client_a.setup_useServer(server_x);
  client_b.setup_useServer(server_y);
  client_c.setup_useServer(server_z);

  // make everybody already be friends with everybody else
  // XXX this would ideally be one of our permutations or just an additional
  //  explicit step (to invite someone who is not a friend of everyone else)
  client_a.setup_superFriends([client_b, client_c]);

  // -- actual testing stuff
  T.action(client_a, 'initiates one-on-one conversation with', client_b,
           'by sending message', msg_a1, function() {
    client_a.writeMessage(conv, msg_a1, [client_b]);
    msg_a1.expect_receivedBy([client_b]);
  });

  T.action(client_b, 'responds to the messsage', msg_a1, 'of', client_a, 'with',
           msg_b1, function() {
    client_b.replyToMessageWith(msg_a1, msg_b1);
    msg_b1.expect_receivedBy([client_a]);
  });

  T.permutation([
    T.action('The conversation hoster,', client_a, 'invites superfriend',
             client_c, 'to the conversation', function() {
      client_a.inviteToConv([client_c], conv);
    }),
    T.action('A participant in the coversation,', client_b,
             'invites superfriend', client_c, 'to the conversation',
             function() {
      client_b.inviteToConv([client_c], conv);
    }),
  ]);

  T.action(client_c, 'joins', conv, 'and receives the earlier messages:',
           msg_a1, msg_b1, function() {
    client_c.joinConv(join_msg, conv);
    client_c.expect_receiveMessages([msg_a1, msg_b1]);
  });

  T.action(client_a, client_b, 'hear about the joining', function() {
    join_msg.expect_receivedBy([client_a, client_b]);
  });

  T.action(client_b, 'sends message', msg_b2, 'as part of', conv,
           'and it is received by', client_a, client_c, function() {
    client_b.replyToMessageWith(msg_b1, msg_b2);
    msg_b2.expect_receivedBy([client_a, client_c]);
  });
  T.action(client_c, 'sends message', msg_c1, 'as part of', conv,
           'and it is received by', client_a, client_b, function() {
    client_c.replyToMessageWith(msg_b2, msg_c1);
    msg_c1.expect_receivedBy([client_a, client_b]);
  });
});

}); // end define
