'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('tgnotify', _('Telegram notifications'),
			_('Messages from the router to Telegram. Create a bot with @BotFather, write anything to it, then get your chat ID from @userinfobot.'));

		s = m.section(form.NamedSection, 'main', 'tgnotify');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'token', _('Bot token'));
		o.password = true;
		o.placeholder = '123456789:AA...';

		o = s.option(form.Value, 'chat_id', _('Chat ID'));
		o.placeholder = '123456789';
		o.validate = function(id, v) {
			return (v === '' || /^-?[0-9]+$|^@[A-Za-z0-9_]+$/.test(v)) ? true : _('Number or @channel');
		};

		o = s.option(form.Flag, 'wan_up', _('Notify when WAN connects'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'ssh_login', _('Notify on SSH login'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Button, '_test', _('Test message'),
			_('Click «Save & Apply» first, then send a test.'));
		o.inputtitle = _('Send test');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return fs.exec('/usr/bin/tg_say', [ '-t', _('Test message from LuCI') ]).then(function(res) {
				if (res.code === 0)
					ui.addNotification(null, E('p', _('Message sent')), 'info');
				else
					ui.addNotification(null, E('p', _('Sending failed: %s').format(res.stderr || res.stdout || res.code)), 'danger');
			}).catch(function(e) {
				ui.addNotification(null, E('p', e.message), 'danger');
			});
		};

		return m.render();
	}
});
