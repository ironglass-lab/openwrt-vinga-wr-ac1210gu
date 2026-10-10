'use strict';
'require view';
'require form';
'require fs';
'require ui';

var DAYS = [
	[ 'mon', _('Mon') ], [ 'tue', _('Tue') ], [ 'wed', _('Wed') ], [ 'thu', _('Thu') ],
	[ 'fri', _('Fri') ], [ 'sat', _('Sat') ], [ 'sun', _('Sun') ]
];

var ACTIONS = [
	[ 'none', _('Nothing') ],
	[ 'leds', _('LEDs on/off') ],
	[ 'wifi2g', _('Wi-Fi 2.4 GHz on/off') ],
	[ 'wifi5g', _('Wi-Fi 5 GHz on/off') ],
	[ 'wifiall', _('All Wi-Fi on/off') ],
	[ 'vpn', _('OpenVPN on/off') ],
	[ 'wan', _('Reconnect WAN') ],
	[ 'reboot', _('Reboot router') ],
	[ 'script', _('Run user script') ]
];

function validTime(section_id, value) {
	return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? true : _('Time as HH:MM, e.g. 01:00');
}

function stateText(out) {
	return (out || '').trim() === 'off' ? _('LEDs are off') : _('LEDs are on');
}

function refreshState() {
	return L.resolveDefault(fs.exec('/usr/bin/ledtimer', [ 'status' ]), null).then(function(res) {
		var el = document.getElementById('ledtimer-state');
		if (el && res && res.code === 0)
			el.textContent = stateText(res.stdout);
	});
}

function ledsCmd(arg) {
	return fs.exec('/usr/bin/leds', [ arg ]).then(function(res) {
		if (res.code !== 0)
			ui.addNotification(null, E('p', res.stderr || res.stdout || res.code), 'danger');
		return refreshState();
	}).catch(function(e) {
		ui.addNotification(null, E('p', e.message), 'danger');
	});
}

return view.extend({
	load: function() {
		return L.resolveDefault(fs.exec('/usr/bin/ledtimer', [ 'status' ]), null);
	},

	render: function(st) {
		var m, s, o;

		m = new form.Map('ledtimer', _('LEDs and button'),
			_('Turns off all router LEDs, including the LAN/WAN port LEDs, by button or on schedule, and sets what the WPS button does.'));

		s = m.section(form.NamedSection, 'main', 'ledtimer', _('Now'));

		o = s.option(form.DummyValue, '_state', _('State'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('strong', { 'id': 'ledtimer-state' }, stateText(st && st.code === 0 ? st.stdout : ''));
		};

		o = s.option(form.Button, '_off', _('Turn all off'));
		o.inputtitle = _('Turn off');
		o.inputstyle = 'remove';
		o.onclick = function() { return ledsCmd('off'); };

		o = s.option(form.Button, '_on', _('Turn all on'));
		o.inputtitle = _('Turn on');
		o.inputstyle = 'apply';
		o.onclick = function() { return ledsCmd('on'); };

		s = m.section(form.NamedSection, 'main', 'ledtimer', _('Schedule'),
			_('LEDs are off from «Off at» until «On at». If «On at» is earlier, the period crosses midnight. Days are the days the off period starts. LEDs switched by hand stay so until the next scheduled switch.'));

		o = s.option(form.Flag, 'enabled', _('Enable schedule'));
		o.rmempty = false;

		o = s.option(form.MultiValue, 'days', _('Days'));
		DAYS.forEach(function(d) { o.value(d[0], d[1]); });
		o.default = 'mon tue wed thu fri sat sun';
		o.rmempty = false;

		o = s.option(form.Value, 'off_time', _('Off at'));
		o.placeholder = '23:00';
		o.rmempty = false;
		o.validate = validTime;

		o = s.option(form.Value, 'on_time', _('On at'));
		o.placeholder = '07:00';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			var r = validTime(section_id, value);
			if (r !== true)
				return r;
			var off = this.section.formvalue(section_id, 'off_time');
			return (off !== value) ? true : _('«Off at» and «On at» must differ');
		};

		s = m.section(form.NamedSection, 'wps', 'button', _('WPS button'),
			_('Short press is under 2 s; long press is 2–8 s (the WPS LED starts blinking at 2 s). Longer presses do nothing. When control is off, the firmware default is used: short press toggles LEDs, long press toggles 2.4 GHz.'));

		o = s.option(form.Flag, 'enabled', _('Control the button here'));
		o.rmempty = false;

		[ [ 'short', _('Short press') ], [ 'long', _('Long press') ] ].forEach(function(p) {
			o = s.option(form.ListValue, p[0], p[1]);
			ACTIONS.forEach(function(a) { o.value(a[0], a[1]); });
			o.depends('enabled', '1');
		});

		o = s.option(form.TextValue, '_script', _('User script'),
			_('Saved as /etc/wps-user.sh and run with sh in the background.'));
		o.rows = 6;
		o.monospace = true;
		o.depends('short', 'script');
		o.depends('long', 'script');
		o.load = function() {
			return L.resolveDefault(fs.read('/etc/wps-user.sh'), '');
		};
		o.write = function(section_id, value) {
			return fs.write('/etc/wps-user.sh', value.trim().replace(/\r\n/g, '\n') + '\n');
		};
		o.remove = function() {};

		return m.render();
	}
});
