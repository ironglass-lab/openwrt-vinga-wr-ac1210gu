include $(TOPDIR)/rules.mk

PKG_NAME:=wifitimer
PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/wifitimer
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Turn off selected Wi-Fi networks on schedule
  PKGARCH:=all
endef

define Package/wifitimer/description
  Per-network (SSID) Wi-Fi schedule: turns off chosen wifi-iface sections
  for a time period and back on, leaving other networks running.
endef

define Package/wifitimer/conffiles
/etc/config/wifitimer
endef

define Build/Compile
endef

define Package/wifitimer/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)/etc/config $(1)/etc/init.d $(1)/lib/upgrade/keep.d
	$(INSTALL_BIN) ./files/wifitimer $(1)/usr/bin/wifitimer
	$(INSTALL_BIN) ./files/wifitimer.init $(1)/etc/init.d/wifitimer
	$(INSTALL_CONF) ./files/wifitimer.config $(1)/etc/config/wifitimer
	$(INSTALL_DATA) ./files/wifitimer.keep $(1)/lib/upgrade/keep.d/wifitimer
endef

$(eval $(call BuildPackage,wifitimer))
