# Telegram: сообщение при входе по SSH
if [ -n "$SSH_CONNECTION" ] &&
   [ "$(uci -q get tgnotify.main.enabled)" = 1 ] &&
   [ "$(uci -q get tgnotify.main.ssh_login)" = 1 ]; then
	( /usr/bin/tg_say "вход по SSH: ${USER:-root} с ${SSH_CONNECTION%% *}" </dev/null >/dev/null 2>&1 & )
fi
