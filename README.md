# OpenWrt for Vinga WR-AC1210GU (board with 16 MB flash)

**Language:** **English** · [Українська](README.uk.md) · [Русский](README.ru.md)

Unofficial build **based on OpenWrt 25.12.5**. It is not a product of the OpenWrt project and is
not supported by it. Everything described here has been tested on two real routers, but you
flash at your own risk.

---

## Contents

1. [Requirements — read this first](#1-requirements--read-this-first)
2. [Hardware](#2-hardware)
3. [Board modification: flash chip](#3-board-modification-flash-chip)
4. [Flash layout](#4-flash-layout)
5. [Breed bootloader](#5-breed-bootloader)
6. [Factory partition: Wi-Fi calibration, MAC, DBDC mode](#6-factory-partition-wi-fi-calibration-mac-dbdc-mode)
7. [Buttons, LEDs, ports](#7-buttons-leds-ports)
8. [What the firmware includes](#8-what-the-firmware-includes)
9. [Building](#9-building)
10. [First flash and upgrades](#10-first-flash-and-upgrades)
11. [USB flash drive as extroot](#11-usb-flash-drive-as-extroot)
12. [Performance and limitations](#12-performance-and-limitations)
13. [Pitfalls](#13-pitfalls)
14. [Repository layout and licenses](#14-repository-layout-and-licenses)

---

## 1. Requirements — read this first

| What | Required | Why |
|---|---|---|
| SPI flash | **16 MB** (W25Q128 or compatible) | the image is ~12 MB and the firmware partition is sized for 16 MB. It will not fit on the stock 8 MB |
| Bootloader | **Breed** (MT7621) | for installing and recovering firmware; the stock JCG bootloader was not tested |
| Factory partition | **the original one** (with this router's calibration) | Wi-Fi power, MAC and DBDC mode depend on it, see [section 6](#6-factory-partition-wi-fi-calibration-mac-dbdc-mode) |
| RAM | nothing to do | the board already has 256 MB, OpenWrt sees all of it (stock used only 128) |
| Tools | SPI programmer (CH341A + SOIC8 clip), soldering station to replace the flash chip | without them you can neither replace the flash nor revive the router after a mistake |
| Connection | PC cabled to a LAN port, static address 192.168.1.2/24 | Breed serves its web UI on 192.168.1.1 without DHCP |

**Do not start anything without a programmer and a full dump of the original flash.** The dump
contains the factory Wi-Fi calibration of your particular router, and no other copy of it exists anywhere.

## 2. Hardware

| | |
|---|---|
| Model / ODM | Vinga WR-AC1210GU = JCG JIR-AC680M (stock: `model=JIR-AC680M`, `customerId=102`) |
| Closest relative in OpenWrt | JCG JHR-AC876M (same button, LED and port wiring) |
| SoC | MediaTek MT7621A, 2 cores / 4 threads, 880 MHz |
| Wi-Fi | **a single** MT7615 in DBDC mode: 2.4 GHz 2×2 + 5 GHz 2×2 (4 antennas, 2 per band). PCIe port 0 |
| RAM | **256 MB DDR3** (Samsung K4W2G1646C-HC12, 2 Gbit x16) — factory-fitted. The stock JCG firmware sees only **128 MB** (the size is hardcoded in its kernel); padavan and OpenWrt see all 256 |
| Flash | stock 8 MB SPI → upgraded to 16 MB (Winbond W25Q128) |
| Ethernet | 4 × LAN + WAN, gigabit (MT7530 switch in the SoC) |
| USB | 1 × USB 3.0 |
| Console | UART, `ttyS0`, 115200 8N1 |
| Power LED | wired directly to 3.3 V, not software-controllable |
| Indicators | blue SMD LEDs; on these boards they are **often burnt out** — see [7.1](#71-burnt-out-leds) |

## 3. Board modification: flash chip

### 3.1. Procedure

1. **Take a full dump of the original flash with a programmer** (8 MB) and store it in two places.
   Check that two consecutive reads produce an identical file (`md5sum`).
2. Desolder the original 8 MB flash and solder in a 16 MB one (W25Q128). It is convenient to fit a SOIC8 socket at the same time.
3. Build the image for the new flash (below) and write it with the programmer.
4. Power on the router with the WPS button held → Breed opens → flash the firmware
   ([section 10](#10-first-flash-and-upgrades)).

No RAM soldering is needed: the board already has a 256 MB chip (Samsung K4W2G1646C-HC12, 2 Gbit).
The stock firmware simply uses half of it — the 128 MB size is hardcoded in its kernel. OpenWrt detects
the memory on its own and sees all 256 MB (`free -m` → about 240 MB in the Mem line).

### 3.2. Image for the new 16 MB flash

You need: `breed.bin` (192 KB, see [section 5](#5-breed-bootloader)) and a full dump of the original flash,
`stock8.bin`. In stock, Factory is at the same address, `0x40000`.

```sh
# blank 16 MB "flash" (all bytes 0xFF)
dd if=/dev/zero bs=1M count=16 | tr '\000' '\377' > new16.bin
# 0x0: Breed bootloader
dd if=breed.bin  of=new16.bin conv=notrunc
# 0x40000: original Factory from the stock dump (64 KB)
dd if=stock8.bin of=new16.bin bs=64k skip=4 seek=4 count=1 conv=notrunc
# check: the MAC in Factory (offset 0x4) must be a "real" one, not 00:0C:43:…
dd if=new16.bin bs=1 skip=$((0x40004)) count=6 2>/dev/null | od -An -tx1
```

Config (`0x30000`) and the firmware (`0x50000`…) stay empty: Breed will create its own settings,
and the firmware will be flashed through its web UI.

## 4. Flash layout

| Address | Size | Partition (OpenWrt) | Contents |
|---|---|---|---|
| `0x000000` | 192 KB | `u-boot` (read-only) | Breed |
| `0x030000` | 64 KB | `u-boot-env` (read-only) | bootloader settings (Config) |
| `0x040000` | 64 KB | `factory` (read-only) | Wi-Fi calibration, MAC |
| `0x050000` | 15.7 MB | `firmware` | kernel + squashfs + `rootfs_data` (jffs2, settings) |

`IMAGE_SIZE := 16064k` (= `0xFB0000`). The `factory` partition is **not writable** from OpenWrt —
change it only via Breed.

## 5. Breed bootloader

**Breed** is a closed-source but free bootloader by HackPascal for MediaTek/Ralink. It is not erased
when flashing firmware, has a web UI for flashing the firmware, the bootloader, Factory and a full flash image,
and lets you take backups. It is the router's main "safety net".

- **The Breed binary is not included in this repository**: it has no open license.
  Download it from the author's website: **https://breed.hackpascal.net/** — the file
  **`breed-mt7621-pbr-m1.bin`** (the "PandoraBox PBR-M1 / Newifi Y2S" variant),
  direct link: https://breed.hackpascal.net/breed-mt7621-pbr-m1.bin
- Why this particular variant: on the PBR-M1 the recovery button is on **GPIO18**, and on the Vinga GPIO18
  is the **WPS** button. With another variant Breed may wait for a different button — you won't be able to enter it.
- Checked revisions:

  | | Ours (on the routers) | On the website (2026-10-10) |
  |---|---|---|
  | Version | 1.1 **r1266**, built 2018-12-29 | 1.1 **r1337**, built 2021-12-15 |
  | md5 | `98027bd18894a424e9e85c0a479eb63b` | `24e62762809c15ba3872e610a37451a3` |
  | File size | 196,608 (padded to 192 KB) | 105,107 |
  | Board (`Board:`) | PandoraBox PBR-M1 / Newifi Y2S | same |
  | DDR init (first stage) | reference | **identical to r1266 byte for byte** |
  | Winbond W25Q128 | supported | supported (+26 new chips) |
  | Flashed on Vinga | **yes** | no, image comparison only |

  By comparison, r1337 differs in the bootloader code (fixes, new flash chips), while the board variant
  (and therefore the GPIO18 button) and the memory init are the same — it should work the same way. After flashing, check the version and
  the `Board:` line on the Breed main page.
- The bootloader partition is 192 KB (`0x30000`). The file from the website is smaller: when writing with a programmer,
  the rest of the partition is filled with `0xFF` (the `dd … conv=notrunc` command from section 3.2 does exactly that).
- The Breed web UI is in Chinese by default. We translated it into English by replacing strings
  inside the unpacked LZMA image (without shifting addresses; the image has no checksum) —
  we do not publish the English binary either, since it is a modified third-party program.

### How to enter Breed

1. Power off the router, **hold WPS**, power on, keep holding for 3–5 s.
2. PC on LAN, static address `192.168.1.2/24`, open `http://192.168.1.1`.

### What to do in Breed first

- **Backup → full flash image (Full flash)** and **EEPROM (Factory)** — save them to your PC.

### Fields on the "Firmware update" page

| Field | What gets written | Touches Factory? |
|---|---|---|
| **Firmware** | only the firmware partition from `0x50000` | no |
| **EEPROM** | only Factory (64 KB) | yes |
| **Bootloader** | only the bootloader | no |
| **Full flash** (programmer image) | the entire flash from the file: bootloader, Config, Factory | **yes** |

For OpenWrt you need **only the Firmware field**.

## 6. Factory partition: Wi-Fi calibration, MAC, DBDC mode

### 6.1. MAC addresses (stock scheme)

| Offset in Factory | What | Value |
|---|---|---|
| `0x0004` | base MAC (Wi-Fi) | `X` |
| `0xE000` | LAN | `X − 1` |
| `0xE006` | WAN | `X − 2` |

In OpenWrt, 5 GHz gets `X + 1` and 2.4 GHz gets `X`.

### 6.2. DBDC mode — byte `0x3E`

The open-source **mt76** driver decides whether to run in DBDC mode (both bands simultaneously) **solely by
byte `0x3E` in Factory**: bits 5:4 = 3, i.e. the value **`0x30`**.

- `0x30` — two networks (`phy0` = 2.4 GHz, `phy1` = 5 GHz). This is what the Vinga's factory-original Factory contains.
- `0x00` — a single radio, "2.4 or 5". This is what the template Factory from the MediaTek SDK contains.

The closed-source padavan driver ignores this byte (DBDC is enabled at build time), so on padavan
the problem is not visible.

Check in OpenWrt:

```sh
cat /sys/kernel/debug/ieee80211/phy0/mt76/dbdc   # should be 1
iw list | grep ^Wiphy                            # phy0 and phy1
```

If the byte is wrong, fix it in a copy of Factory (`printf '\x30' | dd of=factory.bin bs=1 seek=$((0x3e)) conv=notrunc`)
and flash it via Breed → EEPROM, then run `rm /etc/config/wireless; wifi config` on the router.

### 6.3. Calibration and "donor" Factory images

Factory images "from another Vinga" circulate online. The one we came across turned out to be an **SDK template**, not
a factory calibration: placeholder MAC `00:0C:43:26:60:A8` (Ralink prefix), identical power values
of `0x14` on all channels with no corrections, `0x3E = 0x00`.

| Factory | 5 GHz Tx-Power in OpenWrt | What you see in practice |
|---|---|---|
| SDK template ("donor") | 16 dBm | fine at close range; at the edge of coverage the router transmits at 40 MHz instead of 80 |
| factory original (your own) | 20–21 dBm (beyond that, limited by the country) | MCS 9 (866.7 Mbit/s) both ways at close range |

If you don't have your own calibration (the original flash died without a dump), it is better to take a **factory-original Factory from
another board of the same model** and write your own MACs into it (`0x4`, `0xE000`, `0xE006`) — this is more accurate
than the template. Power on individual channels may differ by 1–2 dB.

## 7. Buttons, LEDs, ports

| GPIO | Function | |
|---|---|---|
| 3 | USB LED | active-low, `usbport` trigger |
| 13 | 2.4 GHz LED | active-low, `phy0radio` |
| 14 | WPS LED | active-low; blinks during boot/flashing |
| 15 | 5 GHz LED | active-low, `phy1radio` |
| 16 | **Reset** button (recessed) | |
| 18 | **WPS** button (protruding) | also used to enter Breed |

- Ports: **LAN1…LAN4 = switch ports 0…3**, **WAN = PHY4 via GMAC1**.
- The LAN/WAN port LEDs are inside the MT7530 switch and are not in `/sys/class/leds`; they are turned off via
  PHY registers (`mdio-tools`), see `files/usr/bin/leds`.

### Button behavior in this build

| Button | Action |
|---|---|
| **WPS** short (< 2 s) | all LEDs on/off (including ports) |
| **WPS** 2–8 s (the WPS LED blinks after 2 s) | 2.4 GHz on/off (persistent) |
| **WPS** — custom actions | configured in LuCI: *Services → LEDs and button* |
| **Reset** short | nothing |
| **Reset** ≥ 15 s (WPS blinks after 15 s) | factory reset |

### 7.1. Burnt-out LEDs

The factory blue LEDs on Vinga boards **often burn out**. If an indicator does not light up,
before soldering make sure the problem is the LED and not the configuration:

```sh
ls /sys/class/leds/                          # LED names, e.g. blue:wps
echo none > /sys/class/leds/blue:wps/trigger
echo 1    > /sys/class/leds/blue:wps/brightness   # should light up
echo 0    > /sys/class/leds/blue:wps/brightness
```

If the GPIO toggles but the LED stays dark, it is burnt out — replace it.

- **A blue SMD LED in the 0603 size fits** — it sits perfectly on the factory pads.
  0805 and 1206 are larger and fit these pads poorly.
- Observe polarity: the cathode is marked on the package; check it with a multimeter in
  diode mode before soldering.
- The resistors on the board stay the factory ones — replace only the LED itself.
- Front LED column on the board: D30 (USB, outermost), D17, D15, D13, D9.

## 8. What the firmware includes

### 8.1. Packages (`diffconfig`)

- LuCI in Russian and Ukrainian;
- flash drives and filesystems: `block-mount`, ext4, vfat, exfat, ntfs3, `e2fsprogs`, `dosfstools` (for extroot);
- VPN: WireGuard, OpenVPN (mbedTLS); **pbr** (domain-based routing through VPN), `ip-full`,
  `dnsmasq-full`;
- UPS: NUT (server, upsmon, drivers `usbhid-ups`, `nutdrv_qx`);
- USB modems and phone tethering (RNDIS, QMI, NCM, MBIM, `usb-modeswitch`);
- `nlbwmon`, `https-dns-proxy`, `watchcat`, WoL, `p910nd` printer, `curl`, `htop`, `nano`, `iperf3`,
  `mdio-tools`.

Deliberately **not** included (install from the repository if needed): `ttyd` (pulls in OpenSSL),
`luci-app-nut` (pulls in graphics libraries), `usbutils`, `mc` (pulls in glib2, ~2 MB — install it on
extroot).

### 8.2. Custom packages (`packages/`)

| Package | LuCI | What it does |
|---|---|---|
| `tgnotify` + `luci-app-tgnotify` | *Services → Telegram* | Telegram notifications: WAN/backup link connection, SSH login. `tg_say "text"` from the console. The token is stored in `/etc/config/tgnotify` with 600 permissions |
| `wifitimer` + `luci-app-wifitimer` | *Services → Wi-Fi schedule* | scheduled shutdown of **individual networks (SSIDs)**: e.g. 5 GHz off at night while 2.4 GHz keeps running for the smart home |
| `ledtimer` + `luci-app-ledtimer` | *Services → LEDs and button* | "turn all LEDs off/on" buttons, LED schedule, WPS button actions (LEDs, 2.4/5 GHz, all Wi-Fi, OpenVPN, WAN reconnect, reboot, custom script) |

Common scheduling rules: a period may cross midnight; the day is the day the period **starts**;
the timer fires only on transitions, so a manual on/off stays in effect until the
next scheduled switch; before its first action it waits for time synchronization (NTP).
Log: `logread | grep -E 'wifitimer|ledtimer|wps-button'`.

### 8.3. Custom firmware files (`files/`)

| File | What it does |
|---|---|
| `etc/uci-defaults/99-vinga` | runs once after flashing/reset: hardware + software NAT offloading, packet steering, Wi-Fi country UA and 5 GHz at 80 MHz, IPv6 disabled, WAN — DROP, ping from WAN disabled |
| `etc/rc.button/wps`, `etc/rc.wps/10-vinga` | WPS button with LED feedback (see above) |
| `etc/rc.button/reset` | Reset: short press — nothing, ≥ 15 s — reset |
| `usr/bin/leds on\|off\|toggle` | all LEDs, including port LEDs |
| `etc/banner` | SSH login banner |

`99-vinga` also runs **after an upgrade with settings kept** — after upgrading,
check the Wi-Fi country.

## 9. Building

### 9.1. Dependencies (Ubuntu 24.04)

```sh
sudo apt install build-essential clang flex bison g++ gawk gettext git \
  libncurses-dev libssl-dev python3-dev python3-setuptools rsync swig \
  unzip zlib1g-dev file wget
```

### 9.2. Build

```sh
git clone https://github.com/ironglass-lab/openwrt-vinga-wr-ac1210gu.git
cd openwrt-vinga-wr-ac1210gu
bash build.sh
```

`build.sh`: clones OpenWrt `v25.12.5` into `openwrt/`, applies the board patch, copies `files/`
(fixing permissions), copies `packages/` into `openwrt/package/`, updates feeds, puts
`diffconfig` into `.config`, runs `make defconfig`, builds.

Requires ~20 GB of disk space; the first build takes ~1–1.5 h. Output:

```
openwrt/bin/targets/ramips/mt7621/*vinga_wr-ac1210gu-squashfs-sysupgrade.bin
```

### 9.3. Checking the image before flashing

```sh
cd openwrt
f=$(ls bin/targets/ramips/mt7621/*vinga_wr-ac1210gu-squashfs-sysupgrade.bin)
off=$(grep -obUaP "hsqs" "$f" | head -1 | cut -d: -f1)
tail -c +$((off+1)) "$f" > /tmp/root.sqsh
unsquashfs -lls /tmp/root.sqsh | grep -E "squashfs-root(/etc|/usr)?$|bin/(leds|wifitimer|ledtimer)$|rc.wps/"
```

`squashfs-root`, `/etc` and `/usr` must be **`drwxr-xr-x`** (see [Pitfalls](#13-pitfalls)), and the plugins
must be present.

### 9.4. Build name

`diffconfig` sets a custom distribution name so the build is not confused with official OpenWrt:

```
CONFIG_IMAGEOPT=y
CONFIG_VERSIONOPT=y
CONFIG_VERSION_DIST="Vinga-WRT"
CONFIG_VERSION_MANUFACTURER="Ironglass"
CONFIG_VERSION_MANUFACTURER_URL="https://ironglass.com.ua"
CONFIG_VERSION_HOME_URL="https://github.com/ironglass-lab/openwrt-vinga-wr-ac1210gu"
CONFIG_VERSION_SUPPORT_URL="https://github.com/ironglass-lab/openwrt-vinga-wr-ac1210gu/issues"
```

The name appears in LuCI (*Status → Overview*, bottom line) and in `/etc/openwrt_release`; the image
file name also starts with it (`vinga-wrt-…-sysupgrade.bin`).

### 9.5. Custom packages separately (apk)

```sh
cd openwrt
make package/wifitimer/compile package/luci-app-wifitimer/compile
find bin/packages -name "*wifitimer*.apk"
# on the router:
apk add --allow-untrusted /tmp/*wifitimer*.apk
```

LuCI packages have version `0` (taken from git) — add `--force-reinstall` when updating.
After changing a package's sources: `make package/<name>/clean`.

## 10. First flash and upgrades

### 10.1. First installation (via Breed)

1. In Breed, take a full dump and Factory ([section 5](#5-breed-bootloader)).
2. Breed → firmware update → **Firmware** → `…-squashfs-sysupgrade.bin` → update.
3. Wait 3–4 min. The WPS LED blinks during boot and goes off when the system is ready.
4. `http://192.168.1.1`, login `root` with **no password** → set a password right away.
5. Check DBDC ([6.2](#62-dbdc-mode--byte-0x3e)), the Wi-Fi country and power:
   `iwinfo phy1-ap0 info | grep -E "Channel|Tx-Power"`.

> Until configured, the router serves DHCP in `192.168.1.0/24`. Do not connect its LAN to an
> existing network that uses the same range.

### 10.2. Upgrade (LuCI)

*System → Backup / Flash Firmware → Flash image…*: leave "Keep settings" checked,
enable "Create list of installed packages".

- Before upgrading, check that the files you need outside `/etc/config` will be included in the backup:
  `sysupgrade -l | grep -E "openvpn|crontabs|rc.local|profile.d"`. Add anything missing to `/etc/sysupgrade.conf`.
- The board definition has `$(Device/dsa-migration)` → `compat_version 1.1`. Without it, an upgrade with
  settings kept is refused (`config is incompatible`).
- Packages installed via apk (not part of the firmware) must be reinstalled after an upgrade.

### 10.3. Rollback

- To padavan or a previous image: Breed → Firmware.
- Fully "as it was": Breed → Full flash → the full dump (restores both the bootloader and Factory).
- If even Breed does not start — use the programmer.

## 11. USB flash drive as extroot

Only ~3.9 MB of internal storage is left for settings, so packages are better kept on a flash drive.

### 11.1. Initial setup

```sh
block info                          # find the drive, e.g. /dev/sda1
mkfs.ext4 -L extroot /dev/sda1      # WARNING: erases the drive
UUID=$(block info /dev/sda1 | sed -n 's/.*UUID="\([^"]*\)".*/\1/p')
uci set fstab.extroot=mount
uci set fstab.extroot.uuid="$UUID"
uci set fstab.extroot.target='/overlay'
uci set fstab.extroot.check_fs='1'
uci set fstab.rwm=mount
uci set fstab.rwm.device="$(sed -n -e '/\s\/overlay\s/s/\s.*//p' /etc/mtab)"
uci set fstab.rwm.target='/rwm'
uci commit fstab
mount /dev/sda1 /mnt && tar -C /overlay -cf - . | tar -C /mnt -xf - && umount /mnt
reboot
```

The drive may also hold existing data (ext4): extroot sits alongside it in the `upper/` and `work/` directories.

### 11.2. After a firmware upgrade

On the **first** boot after an upgrade the router starts from internal storage: the settings
are unpacked later than extroot is looked for. Before the next reboot:

```sh
mount /dev/sda1 /mnt
mv /mnt/upper /mnt/upper.old && mv /mnt/work /mnt/work.old   # don't delete the old ones right away
tar -C /overlay -cf - . | tar -C /mnt -xf -
umount /mnt && reboot
df -h /overlay                                               # should show the drive's size
```

Then reinstall the packages that are not in the firmware (`mc terminfo openssh-sftp-server`, etc.).

## 12. Performance and limitations

iperf3 measurements, Redmi Note 13 Pro 5G phone (2×2), 5 GHz channel 100, 80 MHz:

| Conditions | Download / upload, Mbit/s |
|---|---|
| 2 m from the router, factory Factory | ~600 / ~630, link 866.7 (MCS 9, 2 streams) |
| same on padavan (closed-source driver) | ~607 / ~633 |

- **No WED** (Wi-Fi hardware offload): the MT7615 does not have it. Hardware NAT (PPE) accelerates only
  **wired** traffic; Wi-Fi is handled by the CPU. At maximum Wi-Fi throughput the load is
  ~0.6 out of 4 — the ceiling is set by the radio (2×2, 80 MHz), not the CPU. Same on padavan: `hw_nat` for
  Wi-Fi accelerates only NAT, and the Wi-Fi driver runs on the CPU there too.
- **160 MHz** is not available in DBDC mode. Some apps (e.g. LuCI Mobile) offer
  this width anyway — don't select it, 5 GHz will not come up.
- mt76 has no **beamforming** for the MT7615; at the edge of coverage the closed-source padavan driver may be
  slightly faster.
- 5 GHz on DFS channels (52–144): a one-minute radar check after enabling.
- Power is limited by Factory and the selected country (regdomain). Select your own country.

## 13. Pitfalls

1. **Directory permissions in `files/`.** If the `files/` directory is created with `700` permissions, the build carries them over
   to `/`, `/etc`, `/usr` in the image. The kernel boots and failsafe works, but normal boot stalls
   (non-root services cannot enter `/`). `build.sh` sets 755/644 itself; to check, see [9.3](#93-checking-the-image-before-flashing).
2. **DBDC byte `0x3E`** — see [6.2](#62-dbdc-mode--byte-0x3e).
3. **`ip-full` and `dnsmasq-full`** (required by pbr) replace `ip-tiny` and `dnsmasq`. In diffconfig they
   are listed together with `# … is not set` for the old variants; after `make defconfig`, check that
   `.config` contains no `CONFIG_PACKAGE_ip-tiny=y` and no `CONFIG_PACKAGE_dnsmasq=y`.
4. **Kernel modules from the official repository cannot be installed via apk** — a custom build has a different
   `vermagic`. Include the `kmod-*` packages you need in the build.
5. **`build.sh` copies `diffconfig` to `.config` every time** — edits made only in `.config` will be lost.
6. **Hotplug handlers with background processes** (`( … ) &`) — only with the redirection
   `</dev/null >/dev/null 2>&1`, otherwise boot may hang.
7. **OpenVPN mbedTLS vs. an old server (OpenVPN 2.4 / OpenSSL 1.1.1)**: "TLS key negotiation
   failed" is fixed with `tls-version-max 1.2` in the `.ovpn`. If the server pushes `redirect-gateway` but you need
   selective VPN — `pull-filter ignore "redirect-gateway"`.
8. **A foreign DHCP server on the LAN** disables the router's DHCP (`dnsmasq` probes the network) — `uci set dhcp.lan.force=1`.
9. **Busybox ash without Unicode**: Backspace after Cyrillic characters "eats" the prompt — this is display-only.
   Fixed by using `bash` or enabling the Unicode option in busybox at build time.

## 14. Repository layout and licenses

```
0001-ramips-add-support-for-Vinga-WR-AC1210GU.patch   board support: dts + image definition (mt7621.mk)
mt7621_vinga_wr-ac1210gu.dts                          the same dts as a separate file, for reading
diffconfig                                             build configuration
build.sh                                               build script
files/                                                 custom firmware files (section 8.3)
packages/                                              custom packages: tgnotify, wifitimer, ledtimer + LuCI
```

- Patch and dts: **GPL-2.0-or-later OR MIT** (as in the dts header; based on the JCG JHR-AC876M and
  GL.iNet GL-MT1300 dts files from OpenWrt).
- Custom packages and scripts: **MIT** (see `LICENSE`).
- OpenWrt — © OpenWrt Project, GPL-2.0. The name "OpenWrt" is a trademark of the project; this build
  is unofficial.
- Breed — © HackPascal, not included in the repository.

---

Author: **Andrii · Ironglass** — [ironglass.com.ua](https://ironglass.com.ua) ·
[github.com/ironglass-lab](https://github.com/ironglass-lab)
