#!/bin/bash
# Сборка OpenWrt 25.12.5 для Vinga WR-AC1210GU. Запускать из этой папки.
set -e
# права файлов в образе 644/755 независимо от umask системы (Ubuntu даёт 002 → 664)
umask 022
HERE="$(cd "$(dirname "$0")" && pwd)"
TAG=v25.12.5

if [ ! -d "$HERE/openwrt" ]; then
  git clone -b "$TAG" --depth 1 https://github.com/openwrt/openwrt.git "$HERE/openwrt"
fi
cd "$HERE/openwrt"

# патч с поддержкой платы (dts + описание образа); повторный запуск не ломает
if ! grep -q vinga_wr-ac1210gu target/linux/ramips/image/mt7621.mk; then
  git apply "$HERE/0001-ramips-add-support-for-Vinga-WR-AC1210GU.patch"
fi

# свои файлы прошивки: первый запуск, кнопки WPS/Reset, команда leds
# USE_FILES=0 bash build.sh — собрать без своих файлов (для проверки)
rm -rf files
if [ "${USE_FILES:-1}" = 1 ] && [ -d "$HERE/files" ]; then
  cp -r "$HERE/files" files
  # права не наследуем от папки на диске: каталоги 755, файлы 644, скрипты 755
  find files -type d -exec chmod 755 {} +
  find files -type f -exec chmod 644 {} +
  chmod 755 files/etc/uci-defaults/* files/etc/rc.wps/* files/etc/rc.button/* files/usr/bin/*
else
  echo ">>> собираю БЕЗ своих файлов (files/)"
fi
# после правки dts — пересобрать dtb
rm -f build_dir/target-*/linux-ramips_mt7621/image-mt7621_vinga_wr-ac1210gu.dtb
# свои пакеты (Telegram): копия из packages/ в дерево
cp -r "$HERE/packages/." package/
# права не берём из git-копии (Ubuntu даёт 664): убираем запись для группы и остальных
for p in "$HERE"/packages/*/; do chmod -R go-w "package/$(basename "$p")"; done

./scripts/feeds update -a
./scripts/feeds install -a

cp "$HERE/diffconfig" .config
make defconfig

make download -j8
make -j"$(nproc)" || make -j1 V=s

ls -l bin/targets/ramips/mt7621/*vinga*
