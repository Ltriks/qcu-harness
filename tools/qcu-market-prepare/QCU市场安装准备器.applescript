-- Build with osacompile. No DSH automation or configuration access.
on run
    try
        set runtimePath to POSIX path of (path to resource "prepare-market.sh")
        set packagePath to do shell script "/bin/bash " & quoted form of runtimePath & " --path-only"
    on error errorText number errorNumber
        set shortMessage to "无法完成准备。请联系维护者检查保存目录和可用空间。"
        if errorText contains "DOWNLOAD_FAILED:" then
            set shortMessage to "下载未完成。请确认已连接校园局域网后重新打开。"
        else if errorText contains "CACHE_INVALID:" then
            set shortMessage to "已有安装包校验未通过，原文件已保留。请联系维护者，不要自行删除或覆盖。"
        else if errorText contains "INTEGRITY_FAILED:" then
            set shortMessage to "下载内容校验未通过。请联系维护者核对固定包。"
        else if errorText contains "UNSAFE_PATH:" then
            set shortMessage to "保存目录不安全。请联系维护者选择本人私有的普通目录。"
        else if errorText contains "PUBLICATION_RACE:" then
            set shortMessage to "保存期间文件发生变化。请停止并联系维护者。"
        else if errorText contains "CANCELLED:" then
            set shortMessage to "准备已取消，可稍后重新打开。"
        end if
        display dialog shortMessage with title "QCU市场安装准备器" buttons {"知道了"} default button "知道了" with icon caution
        return
    end try

    set readyText to "QCU市场 0.1.0-pilot.9.1 安装包已准备好。" & return & "适用：官方 DSH 0.2.0-rc.2 · Apple Silicon Mac" & return & return & "1. 点击“复制安装路径”。" & return & "2. 自行打开 DSH：插件 → 添加插件 → 粘贴路径。" & return & "3. 核对名称、版本与来源后安装；启用另行确认。" & return & return & "本工具只准备文件，尚未安装或启用市场。"
    set choice to display dialog readyText with title "QCU市场安装准备器" buttons {"稍后", "复制安装路径"} default button "复制安装路径" with icon note
    if button returned of choice is "复制安装路径" then
        set the clipboard to packagePath
    end if
end run
