'use strict';
'require view';
'require form';
'require uci';
'require fs';

var DAYS = [
	[ 'mon', _('Mon') ], [ 'tue', _('Tue') ], [ 'wed', _('Wed') ], [ 'thu', _('Thu') ],
	[ 'fri', _('Fri') ], [ 'sat', _('Sat') ], [ 'sun', _('Sun') ]
];

function bandName(band) {
	switch (band) {
	case '2g': return _('2.4 GHz');
	case '5g': return _('5 GHz');
	case '6g': return _('6 GHz');
	default: return band || '?';
	}
}

function validTime(section_id, value) {
	return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? true : _('Time as HH:MM, e.g. 01:00');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('wireless'),
			L.resolveDefault(fs.exec('/usr/bin/wifitimer', [ 'status' ]), null)
		]);
	},

	render: function(data) {
		var m, s, o, st = data[1];

		m = new form.Map('wifitimer', _('Wi-Fi schedule'),
			_('Turns off selected Wi-Fi networks for a period of time and turns them back on. Other networks keep working, for example 2.4 GHz for smart-home devices.'));

		s = m.section(form.NamedSection, 'main', 'wifitimer');

		o = s.option(form.Flag, 'enabled', _('Enable schedule'));
		o.rmempty = false;

		if (st && st.code === 0 && st.stdout) {
			o = s.option(form.DummyValue, '_status', _('Networks now'));
			o.rawhtml = true;
			o.cfgvalue = function() {
				var rows = st.stdout.trim().split('\n').map(function(line) {
					var f = line.split('|'),
					    state = f[3] === 'on' ? _('working') : (f[4] === '1' ? _('turned off by schedule') : _('turned off'));
					return E('div', [ E('strong', f[1]), ' (%s): %s'.format(bandName(f[2]), state) ]);
				});
				return E('div', rows);
			};
		}

		s = m.section(form.GridSection, 'rule', _('Rules'),
			_('The network is off from «Off at» until «On at». If «On at» is earlier, the period crosses midnight. Days are the days the off period starts. A network switched by hand stays so until the next scheduled switch.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'iface', _('Network'));
		uci.sections('wireless', 'wifi-iface').forEach(function(w) {
			var band = uci.get('wireless', w.device, 'band');
			o.value(w['.name'], '%s (%s)'.format(w.ssid || w['.name'], bandName(band)));
		});

		o = s.option(form.MultiValue, 'days', _('Days'));
		DAYS.forEach(function(d) { o.value(d[0], d[1]); });
		o.default = 'mon tue wed thu fri sat sun';
		o.rmempty = false;

		o = s.option(form.Value, 'off_time', _('Off at'));
		o.placeholder = '01:00';
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

		return m.render();
	}
});
