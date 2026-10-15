#!/bin/bash
# Runtime: macOS system Bash and system utilities only. No installation actions.
set -u
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
export LC_ALL=C
umask 077

QCU_TOOL_VERSION='0.1.0-bootstrap.1'
QCU_MARKET_VERSION='0.1.0-pilot.9.1'
QCU_SOURCE_COMMIT='bb1e5c80a01f26f1ab147717cbd9f79b57b198e3'
QCU_BYTES=43446
QCU_SHA256='ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12'
QCU_URL='http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz'
QCU_FILE="qcu-market-${QCU_MARKET_VERSION}-${QCU_SHA256}.tgz"
mode=json
destination="${HOME-}/Library/Application Support/qcu/market-packages"
attempt=''
curl_pid=''
uid=$(/usr/bin/id -u)

json_string() {
    local value=$1
    value=${value//\\/\\\\}
    value=${value//\"/\\\"}
    printf '"%s"' "$value"
}

cleanup() {
    if [ -n "$curl_pid" ]; then
        kill "$curl_pid" 2>/dev/null || :
        wait "$curl_pid" 2>/dev/null || :
    fi
    if [ -n "$attempt" ]; then
        /bin/rm -f "$attempt/package" "$attempt/headers" "$attempt/status" 2>/dev/null
        /bin/rmdir "$attempt" 2>/dev/null || :
    fi
}
trap cleanup EXIT

fail() {
    local code=$1 message
    case "$code" in
        USAGE) message='参数不正确，请使用随包说明中的命令。' ;;
        UNSAFE_PATH) message='保存目录不安全，请联系维护者选择本人私有的普通目录。' ;;
        CACHE_INVALID) message='已有安装包校验未通过；已保留原文件，请联系维护者。' ;;
        DOWNLOAD_FAILED) message='下载未完成，请确认已连接校园局域网后重新打开。' ;;
        INTEGRITY_FAILED) message='下载内容校验未通过，请联系维护者核对固定包。' ;;
        PUBLICATION_RACE) message='保存期间文件发生变化，请停止并联系维护者。' ;;
        CANCELLED) message='准备已取消，可稍后重新打开。' ;;
        *) code=IO_ERROR; message='无法保存安装包，请联系维护者检查目录和可用空间。' ;;
    esac
    if [ "$mode" = json ]; then
        printf '{"status":"failed","code":"%s","message":' "$code"
        json_string "$message"
        printf ',"tool_version":"%s","market_version":"%s","installed":false,"enabled":false,"official_confirmation_required":true}\n' "$QCU_TOOL_VERSION" "$QCU_MARKET_VERSION"
    fi
    printf '%s: %s\n' "$code" "$message" >&2
    exit 1
}
trap 'fail CANCELLED' HUP INT TERM

while [ "$#" -gt 0 ]; do
    case "$1" in
        --json) mode=json; shift ;;
        --path-only) mode=path; shift ;;
        --destination-directory)
            [ "$#" -ge 2 ] || fail USAGE
            destination=$2; shift 2 ;;
        --help)
            printf '%s\n' 'QCU市场安装准备器 0.1.0-bootstrap.1' \
                '用法: prepare-market.sh [--json | --path-only] [--destination-directory /绝对/私有目录]' \
                '只准备固定市场包；不安装、不启用。默认输出 JSON。'
            exit 0 ;;
        *) fail USAGE ;;
    esac
done

# Ancestors may be owned by root or this user, never writable by group/others.
# The final cache must be owned by this user and private. Never chmod old paths.
no_allow_acl() {
    local listing
    listing=$(/bin/ls -lde "$1" 2>/dev/null) || return 1
    # macOS Home's usual "everyone deny delete" is fine. Conservatively reject
    # any additional allow ACL rather than misreport an ACL-shared path as private.
    printf '%s\n' "$listing" | /usr/bin/awk 'NR > 1 && / allow / { bad=1 } END { exit bad }'
}

safe_directory() {
    local dir=$1 private=$2 owner permissions bits
    [ ! -L "$dir" ] && [ -d "$dir" ] || return 1
    owner=$(/usr/bin/stat -f '%u' "$dir") || return 1
    permissions=$(/usr/bin/stat -f '%Lp' "$dir") || return 1
    bits=$((8#$permissions))
    no_allow_acl "$dir" || return 1
    [ "$owner" = "$uid" ] || [ "$owner" = 0 ] || return 1
    [ $((bits & 0022)) -eq 0 ] || return 1
    if [ "$private" = yes ]; then
        [ "$owner" = "$uid" ] && [ $((bits & 0077)) -eq 0 ] || return 1
    fi
}

check_path() {
    local create=$1 rest component current='' private
    case "$destination" in
        /*) ;;
        *) fail UNSAFE_PATH ;;
    esac
    case "$destination" in
        /|*/|*//*|*/./*|*/../*|*/.|*/..|*[$'\001'-$'\037'$'\177']*) fail UNSAFE_PATH ;;
    esac
    safe_directory / no || fail UNSAFE_PATH
    rest=${destination#/}
    while [ -n "$rest" ]; do
        component=${rest%%/*}
        if [ "$component" = "$rest" ]; then rest=''; else rest=${rest#*/}; fi
        current="$current/$component"
        private=no
        [ -n "$rest" ] || private=yes
        if [ ! -e "$current" ] && [ ! -L "$current" ]; then
            [ "$create" = yes ] || fail UNSAFE_PATH
            /bin/mkdir -m 700 "$current" 2>/dev/null || fail IO_ERROR
        fi
        safe_directory "$current" "$private" || fail UNSAFE_PATH
    done
}

file_identity() { /usr/bin/stat -f '%d:%i:%z:%m:%c' "$1"; }
verify_file() {
    local file=$1 before after owner permissions size hash
    [ ! -L "$file" ] && [ -f "$file" ] || return 1
    before=$(file_identity "$file") || return 1
    owner=$(/usr/bin/stat -f '%u' "$file") || return 1
    permissions=$(/usr/bin/stat -f '%Lp' "$file") || return 1
    size=$(/usr/bin/stat -f '%z' "$file") || return 1
    [ "$owner" = "$uid" ] && [ $((8#$permissions & 0077)) -eq 0 ] || return 1
    no_allow_acl "$file" || return 1
    [ "$size" = "$QCU_BYTES" ] || return 1
    hash=$(/usr/bin/shasum -a 256 < "$file" 2>/dev/null) || return 1
    hash=${hash%% *}
    [ "$hash" = "$QCU_SHA256" ] || return 1
    after=$(file_identity "$file") || return 1
    [ "$before" = "$after" ] && [ ! -L "$file" ] || return 1
    verified_identity=$after
}

ready() {
    local status=$1 identity=$2
    check_path no
    verify_file "$target" || fail PUBLICATION_RACE
    [ "$verified_identity" = "$identity" ] || fail PUBLICATION_RACE
    if [ "$mode" = path ]; then
        printf '%s\n' "$target"
    else
        printf '{"status":"%s","tool_version":"%s","market_version":"%s","source_commit":"%s","bytes":%s,"sha256":"%s","path":' \
            "$status" "$QCU_TOOL_VERSION" "$QCU_MARKET_VERSION" "$QCU_SOURCE_COMMIT" "$QCU_BYTES" "$QCU_SHA256"
        json_string "$target"
        printf ',"installed":false,"enabled":false,"official_confirmation_required":true,"support_baseline":"DSH 0.2.0-rc.2 / Apple Silicon Mac"}\n'
    fi
}

check_path yes
target="$destination/$QCU_FILE"
if [ -e "$target" ] || [ -L "$target" ]; then
    verify_file "$target" || fail CACHE_INVALID
    ready reused "$verified_identity"
    exit 0
fi

attempt=$(/usr/bin/mktemp -d "$destination/.qcu-partial.XXXXXXXX") || fail IO_ERROR
safe_directory "$attempt" yes || fail UNSAFE_PATH
# Files are exclusively created inside this attempt's private directory.
(set -C; : > "$attempt/package"; : > "$attempt/headers"; : > "$attempt/status") || fail IO_ERROR
# Empty environment also removes inherited proxy, auth and CA configuration.
# -q MUST be curl's first argument. Never follow redirects or read curlrc.
# max-filesize bounds modern curl; RLIMIT_FSIZE additionally bounds each output
# even with an older system curl and an unannounced/chunked response.
(
    ulimit -f $(((QCU_BYTES + 511) / 512)) || exit 1
    exec /usr/bin/env -i PATH="$PATH" LC_ALL=C /usr/bin/curl -q \
        --proxy '' --noproxy '*' --proto '=http' --max-redirs 0 \
        --header 'Accept-Encoding: identity' --connect-timeout 5 --max-time 30 \
        --max-filesize "$QCU_BYTES" --silent \
        --dump-header "$attempt/headers" --output "$attempt/package" \
        --write-out '%{http_code}' "$QCU_URL"
) > "$attempt/status" 2>/dev/null &
curl_pid=$!
curl_rc=0
wait "$curl_pid" 2>/dev/null || curl_rc=$?
curl_pid=''
http_status=$(/bin/cat "$attempt/status")
[ "$curl_rc" -eq 0 ] && [ "$http_status" = 200 ] || fail DOWNLOAD_FAILED
/usr/bin/awk '
    BEGIN { bad=0 }
    tolower($0) ~ /^content-encoding:/ {
        value=tolower($0); sub(/^[^:]*:[ \t]*/, "", value); sub(/[ \t\r]*$/, "", value)
        if (value != "identity") bad=1
    }
    END { exit bad }
' "$attempt/headers" || fail INTEGRITY_FAILED
check_path no
verify_file "$attempt/package" || fail INTEGRITY_FAILED
partial_inode=$(/usr/bin/stat -f '%d:%i' "$attempt/package") || fail IO_ERROR
# link(1) uses the exact second pathname, unlike ln's directory-target behavior.
# Atomic link creation refuses every existing target, including directories.
/bin/link "$attempt/package" "$target" 2>/dev/null || fail PUBLICATION_RACE
verify_file "$target" || fail PUBLICATION_RACE
[ "$(/usr/bin/stat -f '%d:%i' "$target")" = "$partial_inode" ] || fail PUBLICATION_RACE
ready new "$verified_identity"
