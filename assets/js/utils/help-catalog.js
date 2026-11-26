/**
 * Contextual-help copy for CrossGuns Snooker League.
 * Pages are keyed by body[data-page]. Topics are keyed by data-help.
 * Copy describes the feature, never a particular player, match, or score.
 */
window.CrossGunsHelpCatalog = {
  pages: {
    home: {
      title: 'Home',
      body: 'The competitions that are current right now. Arrows move between them. A league card shows who leads each group. A knockout card shows the bracket.'
    },
    fixtures: {
      title: 'Fixtures',
      body: 'Matches still to play, or still open for a score, in the competition named under the title. A V button opens the result form when you are allowed to post that match.'
    },
    results: {
      title: 'Results',
      body: 'Scores already posted for the competition named under the title. A score that is still a button can be edited. A plain score is closed.'
    },
    leagues: {
      title: 'Leagues',
      body: 'Tables for the current league. Each row is rank, played, won, lost, frame difference, and points. A muted row still has a result waiting for approval.'
    },
    handicaps: {
      title: 'Handicaps',
      body: 'The latest handicap for each player. It is the number used when a match is scored, as of that match date.'
    },
    'top-breaks': {
      title: 'Top breaks',
      body: 'The biggest breaks for the competition named under the title. Only raw breaks of 25 or more. A handicap that raised the value shows as plus X; otherwise the line shows the actual break.'
    },
    rules: {
      title: 'Rules',
      body: 'The league rules. There are no controls on this page beyond the menu and footer.'
    },
    'under-development': {
      title: 'Under development',
      body: 'A placeholder for a standings view that is not finished. The tables use the same columns as the Leagues page.'
    },
    error: {
      title: 'Page not found',
      body: 'This address does not match a page. Go home, or open another page from the menu.'
    },
    'admin-competitions': {
      title: 'Manage comps',
      body: 'Create and edit leagues and knockouts, choose which one is current, and set groups and players. Unlock Admin Mode from the menu first.'
    },
    'admin-players': {
      title: 'Manage players',
      body: 'Add a player or open one to edit their name, handicap history, and which comps they are on. Unlock Admin Mode from the menu first.'
    },
    'admin-player': {
      title: 'Edit player',
      body: 'Change this player’s name, add or remove handicap rows, and see which comps they are on. Unlock Admin Mode from the menu first.'
    },
    'admin-fixtures': {
      title: 'Manage fixtures',
      body: 'Pick a comp, then add a match or tap V to edit one. Unlock Admin Mode from the menu first.'
    },
    'admin-bulk-players': {
      title: 'Bulk load players',
      body: 'Paste player rows to create players and their handicaps. You can also add them to one comp roster. Unlock Admin Mode from the menu first.'
    },
    'admin-bulk-fixtures': {
      title: 'Bulk load fixtures',
      body: 'Paste match rows for one comp and group. A name that is not already a player is created and added to that roster. Unlock Admin Mode from the menu first.'
    },
    'admin-accounts': {
      title: 'Accounts',
      body: 'Issue a one-time registration code, revoke unused codes, and manage who is an admin or an approver. Unlock Admin Mode from the menu first.'
    }
  },

  topics: {
    'chrome.logo': {
      title: 'Home',
      body: 'Goes to the home page, which shows the competitions that are current.'
    },
    'chrome.menu': {
      title: 'Menu',
      body: 'Opens the list of pages. On a wide screen the same links stay in the header.'
    },
    'chrome.navHome': {
      title: 'Home',
      body: 'Opens the home page and its competition cards.'
    },
    'chrome.navLeagues': {
      title: 'Leagues',
      body: 'Opens the league tables for the current league. Hidden while a knockout is the competition on show.'
    },
    'chrome.navFixtures': {
      title: 'Fixtures',
      body: 'Opens the match list for the competition on show.'
    },
    'chrome.navResults': {
      title: 'Results',
      body: 'Opens posted scores for the competition on show.'
    },
    'chrome.navBreaks': {
      title: 'Top breaks',
      body: 'Opens the list of the biggest breaks in the competition on show.'
    },
    'chrome.navHandicaps': {
      title: 'Handicaps',
      body: 'Opens the latest handicap for each player.'
    },
    'chrome.navRules': {
      title: 'Rules',
      body: 'Opens the league rules.'
    },
    'chrome.navManageComps': {
      title: 'Manage comps',
      body: 'Opens the admin screen for competitions, groups, and rosters. Shown only while Admin Mode is unlocked.'
    },
    'chrome.navManagePlayers': {
      title: 'Manage players',
      body: 'Opens the admin list of players. Shown only while Admin Mode is unlocked.'
    },
    'chrome.navManageFixtures': {
      title: 'Manage fixtures',
      body: 'Opens the admin list of matches. Shown only while Admin Mode is unlocked.'
    },
    'chrome.navBulkPlayers': {
      title: 'Bulk load players',
      body: 'Opens the CSV import for players and handicaps. Shown only while Admin Mode is unlocked.'
    },
    'chrome.navBulkFixtures': {
      title: 'Bulk load fixtures',
      body: 'Opens the CSV import for group matches. Shown only while Admin Mode is unlocked.'
    },
    'chrome.navAccounts': {
      title: 'Accounts',
      body: 'Opens registration codes and player accounts. Shown only while Admin Mode is unlocked.'
    },
    'chrome.connect': {
      title: 'Connect',
      body: 'Opens sign-in. Use the handle and password from registration. From there you can register or reset a password if an admin has given you a code.'
    },
    'chrome.account': {
      title: 'Signed in',
      body: 'The handle you are connected as. Signing in lets a player post their own results, and shows admin tools when the account is an admin.'
    },
    'chrome.signOut': {
      title: 'Sign out',
      body: 'Ends this connection on this browser. You will need to connect again to post a result.'
    },
    'chrome.adminToggle': {
      title: 'Admin Mode',
      body: 'Asks for the admin secret, then shows the manage pages until you lock it or the session expires. If you are already signed in as an admin, this control stays hidden.'
    },
    'chrome.backToTop': {
      title: 'Back to top',
      body: 'Scrolls the page back to the top.'
    },
    'chrome.credit': {
      title: 'Created by JP',
      body: 'Who made this site. Tap the JP logo to watch it come apart into a J and a P and fold back together.'
    },
    'chrome.compName': {
      title: 'Competition on show',
      body: 'The competition these lists use. Change it from the home page arrows. League tables hide while a knockout is on show.'
    },
    'chrome.groupFilter': {
      title: 'Group',
      body: 'Filters the list to one group (Group 1, 2, or 3). Tap the selected group again to clear the filter. Hidden while a knockout is on show.'
    },
    'chrome.playerHandicap': {
      title: 'Handicap',
      body: 'Shows that player’s handicap as it stood on the match date. It does not open a profile.'
    },
    'chrome.close': {
      title: 'Close',
      body: 'Closes this panel. Changes that are not saved yet are dropped.'
    },

    'home.prev': {
      title: 'Previous competition',
      body: 'Moves to the previous competition that is marked current. The title and the card both change.'
    },
    'home.next': {
      title: 'Next competition',
      body: 'Moves to the next competition that is marked current. The title and the card both change.'
    },
    'home.title': {
      title: 'Competition name',
      body: 'The competition in view. Fixtures, results, and the league table follow this choice.'
    },
    'home.carousel': {
      title: 'Competition card',
      body: 'A league card names the current leader of each group. A knockout card is the bracket. Use the arrows to change competition.'
    },
    'home.card': {
      title: 'Competition card',
      body: 'Leaders for a league, or the bracket when this competition is a knockout or has a knockout stage with matches.'
    },
    'bracket.prev': {
      title: 'Earlier round',
      body: 'Shows the previous round of this bracket.'
    },
    'bracket.next': {
      title: 'Later round',
      body: 'Shows the next round of this bracket.'
    },
    'bracket.stage': {
      title: 'Round',
      body: 'The round currently drawn. The arrows move to the rounds before and after it.'
    },
    'bracket.match': {
      title: 'Tie',
      body: 'One match in this round: the two players, or the place they come from, and the frames if a score is in.'
    },

    'fixtures.week': {
      title: 'Week or round',
      body: 'Groups the matches under that week. On a knockout it is the round name instead.'
    },
    'fixtures.match': {
      title: 'Match',
      body: 'The two players. Tap a name for the handicap on the match date. The centre V opens the result form when entry is allowed.'
    },
    'fixtures.enter': {
      title: 'Enter result',
      body: 'Opens the score form for this match. A player in the match can post a score and change it for 24 hours. An approver or an admin can enter or change any match. A pending score still needs approval.'
    },
    'fixtures.closed': {
      title: 'V',
      body: 'Versus, between the two names. This one is not a button, so it does not open the score form. It becomes a button when both players are known and you may enter the score: a player in the match, for 24 hours after a score is posted, or an approver or an admin at any time.'
    },

    'results.score': {
      title: 'Edit result',
      body: 'Opens the score form for this match, under the same rules as posting from Fixtures. A pending score still needs someone to approve it.'
    },
    'results.scoreStatic': {
      title: 'Score',
      body: 'Frames won by each player. It is not a button, so this score can no longer be edited from here.'
    },

    'leagues.group': {
      title: 'Group table',
      body: 'Standings for one group in a monospaced table: points, then the CrossGuns tiebreak chain (including head-to-head and highest adjusted break of 25 or more).'
    },
    'leagues.row': {
      title: 'Player row',
      body: 'Rank, name, played, won, lost, frame difference, and points. A muted row includes a result that is still waiting for approval.'
    },
    'leagues.pending': {
      title: 'Pending results',
      body: 'At least one score in this table is posted but not approved yet. Those rows are muted.'
    },

    'handicaps.table': {
      title: 'Handicap table',
      body: 'Every player and their latest handicap. Older handicaps stay on the player’s admin page and still apply to matches played before the change.'
    },
    'handicaps.row': {
      title: 'Player handicap',
      body: 'That player’s current handicap. It does not open their matches.'
    },

    'breaks.season': {
      title: 'Competition',
      body: 'The competition these breaks belong to. It follows the competition on show.'
    },
    'breaks.list': {
      title: 'Breaks',
      body: 'Largest first. Each line is the break, who made it, and the match. A plus-X note means handicap raised the posted value; otherwise you see the actual break.'
    },
    'breaks.row': {
      title: 'Break',
      body: 'The break value, the player, and the match. A plus-X note is handicap; otherwise the actual break. It does not open the match.'
    },

    'rules.body': {
      title: 'Rules',
      body: 'The written rules for the league. Nothing here is editable.'
    },
    'error.home': {
      title: 'Go home',
      body: 'Leaves this missing page and opens the home page.'
    },

    'result.dialog': {
      title: 'Result form',
      body: 'Post or edit the frames and any breaks for this match. Save stores it. A player’s own score stays pending until an approver or an admin approves it.'
    },
    'result.approve': {
      title: 'Approve',
      body: 'Marks this score as approved. Only an approver or an admin sees this, and it shows when a score is still pending.'
    },
    'result.date': {
      title: 'Match date',
      body: 'The date the match was played, as day, short month, and year. The handicaps shown next to the names follow this date.'
    },
    'result.datePicker': {
      title: 'Pick a date',
      body: 'Opens a calendar and writes the chosen day into the match date.'
    },
    'result.frames': {
      title: 'Frames',
      body: 'Adds or removes a frame for that player. The number is frames won. It cannot go past the frames needed to win the match.'
    },
    'result.breaks': {
      title: 'Breaks',
      body: 'Breaks for that player, separated by commas. They are stored against this match and can appear on Top Breaks.'
    },
    'result.save': {
      title: 'Save',
      body: 'Stores the date, frames, and breaks. An approver’s or admin’s score is approved immediately. A player’s score waits for approval.'
    },
    'result.cancel': {
      title: 'Cancel',
      body: 'Closes the form without saving.'
    },
    'result.slip': {
      title: 'Result slip',
      body: 'Attaches a photo of the paper slip. The picture is compressed before it is saved. With a photo already attached, this opens it so you can replace or remove it.'
    },
    'result.slipTake': {
      title: 'Take photo',
      body: 'Opens the camera. The picture is compressed, then attached to this result when you save.'
    },
    'result.slipGallery': {
      title: 'Choose from gallery',
      body: 'Picks an existing picture. It is compressed, then attached to this result when you save.'
    },
    'result.slipCancel': {
      title: 'Cancel',
      body: 'Closes the photo choices without attaching anything.'
    },
    'result.slipPhoto': {
      title: 'Slip photo',
      body: 'The picture attached to this result. Replace or remove it with the buttons underneath. Removing it is kept when you save the result.'
    },
    'result.slipReplace': {
      title: 'Replace photo',
      body: 'Takes or picks a new picture. The previous one is dropped when you save.'
    },
    'result.slipRemove': {
      title: 'Remove photo',
      body: 'Drops the attached picture. The result itself is unchanged until you save.'
    },

    'sheet.unlock': {
      title: 'Unlock Admin Mode',
      body: 'Checks the admin secret and unlocks the manage pages on this browser until you lock them or the session expires.'
    },
    'sheet.secret': {
      title: 'Secret',
      body: 'The admin password. It is not a player account password.'
    },
    'sheet.unlockSubmit': {
      title: 'Unlock',
      body: 'Sends the secret. If it matches, Admin Mode stays on for this browser session.'
    },
    'sheet.cancel': {
      title: 'Cancel',
      body: 'Closes this panel without changing anything.'
    },

    'sheet.connect': {
      title: 'Connect',
      body: 'Signs in with a handle and password. A signed-in player can post their own results. An admin account also unlocks the manage pages.'
    },
    'sheet.registerLink': {
      title: 'Register',
      body: 'Opens registration. You need a one-time code from an admin, and you pick an existing player who does not already have an account.'
    },
    'sheet.handle': {
      title: 'Handle',
      body: 'The name you sign in with. It is 3 to 20 letters or digits, and it is not the same thing as the player name on the tables.'
    },
    'sheet.password': {
      title: 'Password',
      body: 'The password for this handle. Registration asks for at least 8 characters.'
    },
    'sheet.connectSubmit': {
      title: 'Connect',
      body: 'Signs in. A wrong handle or password stays on this panel with the reason.'
    },
    'sheet.forgot': {
      title: 'Forgot password',
      body: 'Opens the reset form. An admin must already have issued a one-time reset code for the handle.'
    },
    'sheet.register': {
      title: 'Register',
      body: 'Creates an account from a one-time code, a new handle, a password, and an unclaimed player. The code works once and expires after 30 days.'
    },
    'sheet.regCode': {
      title: 'Registration code',
      body: 'The one-time code an admin issued. It is used once and expires after 30 days.'
    },
    'sheet.password2': {
      title: 'Confirm password',
      body: 'Type the same password again. Registration stops if the two do not match.'
    },
    'sheet.playerPick': {
      title: 'Your name',
      body: 'The league player this account belongs to. Only players who do not already have an account are listed.'
    },
    'sheet.registerSubmit': {
      title: 'Register',
      body: 'Creates the account and signs you in when the code, handle, password, and player are all accepted.'
    },
    'sheet.reset': {
      title: 'Reset password',
      body: 'Sets a new password for a handle, using a one-time code an admin issued. The code lasts 24 hours and works once.'
    },
    'sheet.resetCode': {
      title: 'Reset code',
      body: 'The one-time code from Accounts. It lasts 24 hours and cannot be used twice.'
    },
    'sheet.resetSubmit': {
      title: 'Update password',
      body: 'Saves the new password, then returns to Connect so you can sign in with it.'
    },

    'adminFx.comp': {
      title: 'Comp',
      body: 'The competition whose matches are listed. Changing it reloads the list.'
    },
    'adminFx.add': {
      title: 'Add fixture',
      body: 'Opens a blank match for this comp. A league match needs a group and a week. A knockout match needs a round.'
    },
    'adminFx.edit': {
      title: 'Edit fixture',
      body: 'Opens this match so you can change the players, the week or round, the length, or delete it.'
    },
    'adminFx.dialog': {
      title: 'Fixture',
      body: 'The match you are adding or editing. Save writes it to this comp. Delete removes it.'
    },
    'adminFx.stage': {
      title: 'Stage',
      body: 'Group for a league week, or Knockout for a round. The choice has to match the comp: a knockout comp has no group stage.'
    },
    'adminFx.group': {
      title: 'Group',
      body: 'The group this week’s match belongs to. Players should already be on that group’s roster.'
    },
    'adminFx.week': {
      title: 'Week',
      body: 'The week number this match is listed under on Fixtures.'
    },
    'adminFx.round': {
      title: 'Round',
      body: 'The knockout round this match belongs to, such as a quarter-final or the final.'
    },
    'adminFx.bestOf': {
      title: 'Best of',
      body: 'How many frames the match is played over. Use an odd number from 1 to 9. The winner is the first player to take more than half of them.'
    },
    'adminFx.player': {
      title: 'Player',
      body: 'One side of the match. The two players have to be different.'
    },
    'adminFx.save': {
      title: 'Save',
      body: 'Writes this match. It shows on Fixtures for the comp you picked.'
    },
    'adminFx.cancel': {
      title: 'Cancel',
      body: 'Closes the form without saving.'
    },
    'adminFx.delete': {
      title: 'Delete',
      body: 'Removes this match. Shown only when you are editing a match that already exists.'
    },

    'adminComps.add': {
      title: 'Add comp',
      body: 'Starts a new league or knockout. Save it before you can add groups or players.'
    },
    'adminComps.list': {
      title: 'Competitions',
      body: 'Every comp. Tap one to edit its name, whether it is current, and its groups or players.'
    },
    'adminComps.row': {
      title: 'Competition',
      body: 'Opens that comp. Current is the one the public pages show for its type.'
    },
    'adminComps.dialog': {
      title: 'Comp',
      body: 'Name, type, and whether this comp is the current one. Groups and players are edited here after the first save.'
    },
    'adminComps.name': {
      title: 'Name',
      body: 'The name shown on the home card and at the top of Fixtures, Results, and Leagues.'
    },
    'adminComps.type': {
      title: 'Type',
      body: 'League comps use groups and a table. Knockout comps use rounds and a roster of players.'
    },
    'adminComps.current': {
      title: 'Current',
      body: 'Makes this the comp the site shows for its type. Only one league and one knockout are current.'
    },
    'adminComps.addGroup': {
      title: 'Add group',
      body: 'Opens a new group for this league. Each group needs at least two players, and a player can be in only one group.'
    },
    'adminComps.group': {
      title: 'Group',
      body: 'Opens that group to change its name, order, or players. A warning means it still has fewer than two players.'
    },
    'adminComps.addKnockout': {
      title: 'Add knockout stage',
      body: 'Creates a knockout comp linked to this league, for the finals after the groups.'
    },
    'adminComps.knockoutStage': {
      title: 'Knockout stage',
      body: 'Opens the knockout comp linked to this league.'
    },
    'adminComps.players': {
      title: 'Players',
      body: 'Tick the players on this knockout. The ticks are kept when you save the comp. A player already on another current roster is not listed.'
    },
    'adminComps.delete': {
      title: 'Delete',
      body: 'Deletes this comp. Shown only for a comp that already exists.'
    },
    'adminComps.cancel': {
      title: 'Cancel',
      body: 'Closes the form without saving.'
    },
    'adminComps.save': {
      title: 'Save comp',
      body: 'Writes the name, type, current flag, and, on a knockout, the ticked players.'
    },
    'adminComps.groupId': {
      title: 'Group id',
      body: 'A short id used in the data: lowercase letters, numbers, and hyphens. It is not the name players see.'
    },
    'adminComps.groupOrder': {
      title: 'Order',
      body: 'Where this group sits among the others. Lower numbers come first.'
    },
    'adminComps.groupName': {
      title: 'Display name',
      body: 'The name shown above the table and on the group filter.'
    },
    'adminComps.groupPlayers': {
      title: 'Group players',
      body: 'Tick who is in this group. Players already in another group of this comp are left out. Save Group keeps the ticks.'
    },
    'adminComps.removeGroup': {
      title: 'Remove group',
      body: 'Deletes this group from the comp. Shown only when you are editing a group that already exists.'
    },
    'adminComps.saveGroup': {
      title: 'Save group',
      body: 'Writes the id, name, order, and ticked players.'
    },

    'adminPlayers.add': {
      title: 'Add player',
      body: 'Opens a new player. You can set the name now and add handicaps after the player exists.'
    },
    'adminPlayers.list': {
      title: 'Players',
      body: 'Everyone in the league. Tap a row to edit that player.'
    },
    'adminPlayers.row': {
      title: 'Player',
      body: 'Opens that player’s name, handicap history, and comps. It does not show their results.'
    },

    'adminPlayer.back': {
      title: 'Back to players',
      body: 'Returns to the player list. Unsaved changes on this page are not kept.'
    },
    'adminPlayer.name': {
      title: 'Name',
      body: 'The name shown on tables, fixtures, and breaks.'
    },
    'adminPlayer.delete': {
      title: 'Delete player',
      body: 'Removes this player. Shown only after the player has been saved once.'
    },
    'adminPlayer.cancel': {
      title: 'Cancel',
      body: 'Returns to the player list without saving the name.'
    },
    'adminPlayer.save': {
      title: 'Save player',
      body: 'Writes the name. Handicaps are saved from their own form.'
    },
    'adminPlayer.addHandicap': {
      title: 'Add handicap',
      body: 'Opens a new handicap row: the number, and the date it starts to apply.'
    },
    'adminPlayer.handicap': {
      title: 'Handicap',
      body: 'The handicap number. Matches use the row whose date is on or before the match date.'
    },
    'adminPlayer.handicapDate': {
      title: 'Effective date',
      body: 'The first day this handicap applies. Later rows replace it from their own date.'
    },
    'adminPlayer.cancelHandicap': {
      title: 'Cancel',
      body: 'Closes the handicap form without writing a row.'
    },
    'adminPlayer.saveHandicap': {
      title: 'Save handicap',
      body: 'Adds or updates this handicap row. The public Handicaps page shows the latest one.'
    },
    'adminPlayer.handicapRow': {
      title: 'Handicap row',
      body: 'Opens that handicap so you can change the number or the date. The newest row is the current one.'
    },
    'adminPlayer.deleteHandicap': {
      title: 'Delete handicap',
      body: 'Removes that handicap row. Matches already played keep the value that applied on their date only if another row still covers it.'
    },
    'adminPlayer.comps': {
      title: 'Comps',
      body: 'The competitions this player is on, and whether each one is a league or a knockout. Membership is edited on the comp, not here.'
    },

    'adminBulk.back': {
      title: 'Back to players',
      body: 'Returns to the player list.'
    },
    'adminBulk.roster': {
      title: 'Add to a roster',
      body: 'When ticked, each imported player is also added to the comp and group you pick. Leave it off to create players and handicaps only.'
    },
    'adminBulk.comp': {
      title: 'Roster comp',
      body: 'The competition that receives the imported players when “add to a roster” is ticked.'
    },
    'adminBulk.group': {
      title: 'Roster group',
      body: 'The group those players join. Ignored unless you are also adding them to a roster.'
    },
    'adminBulk.csv': {
      title: 'Player rows',
      body: 'One player per line: name, handicap, and the date that handicap starts. Comma or tab. A header row is optional. The player id is taken from the name.'
    },
    'adminBulk.run': {
      title: 'Import rows',
      body: 'Creates or updates each player and handicap. Rows that fail are listed in the log underneath. You can run it again.'
    },
    'adminBulk.log': {
      title: 'Import log',
      body: 'What the last import did, line by line, including any row that was skipped.'
    },
    'adminBulkFx.comp': {
      title: 'Comp',
      body: 'The competition these matches are added to.'
    },
    'adminBulkFx.group': {
      title: 'Group',
      body: 'The group the matches belong to. New players named in the file are added to this group.'
    },
    'adminBulkFx.csv': {
      title: 'Fixture rows',
      body: 'One match per line: week number, then the two player names. Comma or tab. A header row is optional. An unknown name creates a player.'
    },
    'adminBulkFx.run': {
      title: 'Import rows',
      body: 'Adds the matches to the comp and group you picked. The log lists anything that could not be imported. You can run it again.'
    },

    'accounts.note': {
      title: 'Note',
      body: 'An optional reminder of who the code is for. It is not the code, and it is not a player name.'
    },
    'accounts.issue': {
      title: 'Issue code',
      body: 'Creates a registration code. It is shown once, works once, and expires after 30 days. The player uses it on Register.'
    },
    'accounts.code': {
      title: 'New code',
      body: 'The code just issued. Copy or share it now. It cannot be looked up again after you leave.'
    },
    'accounts.copy': {
      title: 'Copy',
      body: 'Copies the code so you can paste it to the player.'
    },
    'accounts.share': {
      title: 'Share',
      body: 'Opens the device share sheet with the code. If sharing is cancelled or unavailable, the code is copied instead.'
    },
    'accounts.invites': {
      title: 'Unused codes',
      body: 'Registration and reset codes that have not been used yet. Revoke throws a code away before anyone uses it.'
    },
    'accounts.revoke': {
      title: 'Revoke',
      body: 'Cancels this unused code. A player can no longer register or reset with it.'
    },
    'accounts.list': {
      title: 'Player accounts',
      body: 'Handles that have registered. Tap one to change admin or approver rights, or to issue a password reset.'
    },
    'accounts.account': {
      title: 'Account',
      body: 'Opens that handle. You can make them an admin or an approver, disable the account, or issue a reset code.'
    },
    'accounts.dialog': {
      title: 'Account',
      body: 'Rights for this handle. An admin can use the manage pages while signed in. An approver can enter and approve any score, and those scores are approved immediately. An approver cannot use the other admin tools.'
    },
    'accounts.admin': {
      title: 'Admin',
      body: 'Gives or removes admin rights. An admin who is signed in sees the manage pages without the secret.'
    },
    'accounts.approver': {
      title: 'Approver',
      body: 'Gives or removes approver rights. An approver can enter, edit, and approve any match. Those scores are approved as soon as they are saved.'
    },
    'accounts.reset': {
      title: 'Password reset',
      body: 'Issues a one-time reset code for this handle. It lasts 24 hours. The player types it on Forgot password. It is shown once.'
    },
    'accounts.disable': {
      title: 'Disable account',
      body: 'Stops this handle from signing in. You can turn the account back on from the same button.'
    }
  }
};
