#!/bin/bash
# Compare two OpenWrt sysupgrade images: package list, file tree, file contents, permissions.
# Usage: bash tools/compare-images.sh OLD.bin NEW.bin
# Needs python3 and unsquashfs (from the OpenWrt tree or: sudo apt install squashfs-tools).
set -e
OLD="$1"; NEW="$2"
[ -f "$OLD" ] && [ -f "$NEW" ] || { echo "usage: bash compare-images.sh OLD.bin NEW.bin"; exit 1; }

W=/tmp/vinga-cmp
rm -rf "$W"; mkdir -p "$W"

# unsquashfs: prefer the one built by OpenWrt (xz support), else the system one
US=""
for d in "$(dirname "$NEW")/../../../../staging_dir/host/bin" "$(dirname "$OLD")/../../../../staging_dir/host/bin"; do
  [ -x "$d/unsquashfs4" ] && { US="$d/unsquashfs4"; break; }
done
[ -n "$US" ] || US="$(command -v unsquashfs || true)"
[ -n "$US" ] || { echo "unsquashfs not found: sudo apt install squashfs-tools"; exit 1; }

# offset of the squashfs inside the image: "hsqs" magic with version 4.0
offset() {
  python3 - "$1" <<'PY'
import sys, struct
d = open(sys.argv[1], 'rb').read()
i = d.find(b'hsqs')
while i >= 0:
    blk = struct.unpack_from('<I', d, i + 12)[0]
    major, minor = struct.unpack_from('<HH', d, i + 28)
    if major == 4 and minor == 0 and blk and blk & (blk - 1) == 0:
        print(i); break
    i = d.find(b'hsqs', i + 1)
PY
}

n=0
for img in "$OLD" "$NEW"; do
  n=$((n + 1)); tag=$([ $n = 1 ] && echo old || echo new)
  off=$(offset "$img")
  [ -n "$off" ] || { echo "no squashfs found in $img"; exit 1; }
  dd if="$img" of="$W/$tag.sqsh" bs=4k iflag=skip_bytes skip="$off" status=none
  "$US" -q -n -d "$W/$tag" "$W/$tag.sqsh" >/dev/null 2>&1 || "$US" -n -d "$W/$tag" "$W/$tag.sqsh" >/dev/null
  echo "$tag: $(basename "$img")  md5 $(md5sum < "$img" | cut -c1-32)  squashfs @ $off  entries: $(find "$W/$tag" | wc -l)"
done

echo
echo "=== 1. Packages (apk database inside the image) ==="
for t in old new; do
  db="$W/$t/lib/apk/db/installed"
  if [ -f "$db" ]; then
    awk '/^P:/{p=substr($0,3)} /^V:/{print p" "substr($0,3)}' "$db" | sort > "$W/$t.pkgs"
  else
    ls "$W/$t/usr/lib/opkg/info" 2>/dev/null | sed -n 's/\.control$//p' | sort > "$W/$t.pkgs"
  fi
done
echo "packages: old $(wc -l < "$W/old.pkgs"), new $(wc -l < "$W/new.pkgs")"
if diff -u "$W/old.pkgs" "$W/new.pkgs" > "$W/pkgs.diff"; then
  echo "IDENTICAL: same packages, same versions"
else
  grep '^[-+][^-+]' "$W/pkgs.diff"
fi

echo
echo "=== 2. Files present in only one image ==="
(cd "$W/old" && find . | sort) > "$W/old.list"
(cd "$W/new" && find . | sort) > "$W/new.list"
diff "$W/old.list" "$W/new.list" | grep '^[<>]' || echo "none - same set of files"

echo
echo "=== 3. Files with different content ==="
diff -rq --no-dereference "$W/old" "$W/new" 2>/dev/null | grep -v '^Only in' | grep -v 'special file' \
  | sed "s|$W/old||; s| and $W/new.*||; s|^Files ||; s| differ$||" > "$W/changed" || true
if [ -s "$W/changed" ]; then cat "$W/changed"; else echo "none - all files byte-identical"; fi

echo
echo "=== 4. Permissions ==="
(cd "$W/old" && find . -printf '%m %p\n' | sort -k2) > "$W/old.perm"
(cd "$W/new" && find . -printf '%m %p\n' | sort -k2) > "$W/new.perm"
diff "$W/old.perm" "$W/new.perm" | grep '^[<>]' || echo "identical"

echo
echo "Details for one file: diff $W/old/PATH $W/new/PATH"
