include $(TOPDIR)/rules.mk

PKG_NAME:=tgnotify
PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/tgnotify
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Telegram notifications (WAN up, SSH login)
  DEPENDS:=+curl +ca-bundle
  PKGARCH:=all
endef

define Package/tgnotify/description
  Sends Telegram messages on router events: WAN connected, SSH login.
  Command line: tg_say "text"
endef

define Package/tgnotify/conffiles
/etc/config/tgnotify
endef

define Build/Compile
endef

define Package/tgnotify/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)/etc/config $(1)/etc/hotplug.d/iface $(1)/etc/profile.d
	$(INSTALL_BIN) ./files/tg_say $(1)/usr/bin/tg_say
	$(INSTALL_CONF) ./files/tgnotify.config $(1)/etc/config/tgnotify
	$(INSTALL_DATA) ./files/99-tgnotify $(1)/etc/hotplug.d/iface/99-tgnotify
	$(INSTALL_DATA) ./files/tgnotify-ssh.sh $(1)/etc/profile.d/tgnotify-ssh.sh
endef

$(eval $(call BuildPackage,tgnotify))
