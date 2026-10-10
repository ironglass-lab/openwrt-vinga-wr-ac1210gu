include $(TOPDIR)/rules.mk

PKG_NAME:=ledtimer
PKG_VERSION:=1.0
PKG_RELEASE:=2
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/ledtimer
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=LEDs on/off on schedule and programmable WPS button
  PKGARCH:=all
endef

define Package/ledtimer/description
  Schedule for all router LEDs, including switch port LEDs, and
  configurable WPS button actions (short/long press). Needs the
  /usr/bin/leds script from the Vinga WR-AC1210GU firmware build.
endef

define Package/ledtimer/conffiles
/etc/config/ledtimer
endef

define Build/Compile
endef

define Package/ledtimer/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)/etc/config $(1)/etc/init.d $(1)/etc/rc.wps $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/ledtimer $(1)/usr/bin/ledtimer
	$(INSTALL_BIN) ./files/ledtimer.init $(1)/etc/init.d/ledtimer
	$(INSTALL_CONF) ./files/ledtimer.config $(1)/etc/config/ledtimer
	$(INSTALL_BIN) ./files/ledtimer.wps $(1)/etc/rc.wps/05-ledtimer
	$(INSTALL_BIN) ./files/ledtimer.defaults $(1)/etc/uci-defaults/90-ledtimer
endef

$(eval $(call BuildPackage,ledtimer))
