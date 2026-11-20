// MIT. A native Windows entry point; does not alter the vendor application.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Launcher {
    private static string DataHome() { return Environment.GetEnvironmentVariable("QCU_TEACHER_TEST_HOME") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "QCU-DSH", "teacher", "0.1.0-rc.4.5"); }
    private static void Commit(string stage, string target) {
        string home = Path.GetFullPath(DataHome()); stage = Path.GetFullPath(stage); target = Path.GetFullPath(target);
        if (!String.Equals(target, home, StringComparison.OrdinalIgnoreCase) || !String.Equals(Path.GetDirectoryName(stage), Path.GetDirectoryName(home), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(stage).StartsWith(".qcu-prepare-")) throw new Exception("Commit path refused");
        foreach (string start in new string[] { stage, Path.GetDirectoryName(home) }) for (string p = start; !String.IsNullOrEmpty(p); p = Path.GetDirectoryName(p)) if ((File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0) throw new Exception("Commit link refused");
        Directory.Move(stage, target); // Windows refuses an existing destination, including an empty directory.
    }
    private static void Failure(string message, bool checking) {
        string body = message + "\n\n套件 0.1.0-rc.4.5 · 构建 rc45.7 · Windows x64\n已有数据保留。";
        if (!body.Contains("故障编号：")) body += "\n故障编号：" + Guid.NewGuid().ToString();
        if (checking) { Console.Error.WriteLine(body); Environment.ExitCode = 1; return; }
        using (var f = new Form()) {
            f.Text = "QCU Buddy暂时未能打开"; f.Width = 640; f.Height = 420; f.StartPosition = FormStartPosition.CenterScreen;
            var text = new TextBox { Multiline=true, ReadOnly=true, Dock=DockStyle.Fill, ScrollBars=ScrollBars.Vertical, Text=body.Replace("\n", "\r\n") };
            var buttons = new FlowLayoutPanel { Dock=DockStyle.Bottom, Height=48 };
            var copy = new Button { Text="复制诊断", AutoSize=true }; copy.Click += delegate { try { Clipboard.SetText(body); } catch { MessageBox.Show("请手动选择并复制诊断文字。"); } };
            var export = new Button { Text="导出诊断", AutoSize=true }; export.Click += delegate { using(var dialog = new SaveFileDialog { FileName="QCU启动诊断.txt", Filter="文本文件|*.txt" }) if(dialog.ShowDialog()==DialogResult.OK) try { File.WriteAllText(dialog.FileName, body, Encoding.UTF8); } catch { MessageBox.Show("无法保存，请选择有写入权限的位置。"); } };
            var close = new Button { Text="关闭", AutoSize=true }; close.Click += delegate { f.Close(); };
            buttons.Controls.Add(copy); buttons.Controls.Add(export); buttons.Controls.Add(close); f.Controls.Add(text); f.Controls.Add(buttons); f.ShowDialog();
        }
        Environment.ExitCode = 1;
    }
    private static string Quote(string value) { return "\"" + value + "\""; }
    [STAThread]
    private static void Main(string[] args) {
        if (args.Length == 3 && args[0] == "--commit-upgrade") { try { Commit(args[1], args[2]); } catch { Environment.ExitCode = 11; } return; }
        bool checking = args.Length == 1 && args[0] == "--prepare-only";
        string root = AppDomain.CurrentDomain.BaseDirectory;
        try {
            if (root.StartsWith(@"\\")) throw new Exception("QCU_TEACHER_ERROR: [QCU-ST-1304] 请把整个 QCU Buddy 文件夹复制到Windows本地磁盘（例如C盘）后再打开。当前是Mac/网络共享目录，原配置与资料保留。");
            string executable = Path.Combine(root, "program", "DeepSeek Harness.exe");
            string bootstrap = Path.Combine(root, "support", "start.cjs");
            if (!File.Exists(executable) || !File.Exists(bootstrap))
                throw new Exception("请先解压整个文件夹，再打开QCU Buddy。请勿单独移动此启动文件。");
            var setup = new ProcessStartInfo(executable,
                "--expose-internals " + Quote(bootstrap) + " prepare --kit " + Quote(root.TrimEnd('\\')));
            setup.UseShellExecute = false;
            setup.CreateNoWindow = true;
            setup.WorkingDirectory = root;
            setup.RedirectStandardOutput = true;
            setup.RedirectStandardError = true;
            setup.StandardOutputEncoding = Encoding.UTF8;
            setup.StandardErrorEncoding = Encoding.UTF8;
            setup.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            setup.EnvironmentVariables.Remove("NODE_OPTIONS");
            setup.EnvironmentVariables.Remove("NODE_PATH");
            setup.EnvironmentVariables["QCU_SUITE_SUPPORT"] = Path.Combine(root, "support");
            setup.EnvironmentVariables["QCU_SUITE_LAUNCHER"] = Application.ExecutablePath;
            string output;
            var outputText = new StringBuilder();
            string errors = "";
            using (var child = new Process()) {
                child.StartInfo = setup;
                child.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) {
                    if (e.Data != null) errors += e.Data + Environment.NewLine;
                };
                child.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) {
                    if (e.Data != null) outputText.AppendLine(e.Data);
                };
                child.Start();
                child.BeginErrorReadLine();
                child.BeginOutputReadLine();
                if (!child.WaitForExit(120000)) {
                    try { child.Kill(); } catch (InvalidOperationException) { }
                    throw new Exception("准备时间较长，请稍后重试。如仍未打开，请联系维护人员。不要删除已有数据。");
                }
                child.WaitForExit();
                output = outputText.ToString();
                if (child.ExitCode != 0) { int at = errors.IndexOf("QCU_TEACHER_ERROR:"); throw new Exception(at >= 0 ? errors.Substring(at) : "[QCU-ST-1303] 运行环境异常退出，请联系维护人员。"); }
            }
            string home = null;
            foreach (string line in output.Split('\n')) {
                if (line.StartsWith("QCU_TEACHER_HOME:")) home = line.Substring(17).Trim();
            }
            if (String.IsNullOrWhiteSpace(home) || !Directory.Exists(home))
                throw new Exception("未能确认城院数据目录，请联系维护人员。");
            if (checking) {
                File.WriteAllText(Path.Combine(home, "launcher-check.txt"), home, Encoding.UTF8);
                return;
            }
            var app = new ProcessStartInfo(executable, Quote("--user-data-dir=" + Path.Combine(home, "electron")));
            app.UseShellExecute = false;
            app.CreateNoWindow = true;
            app.WorkingDirectory = Path.Combine(home, "workspace");
            app.EnvironmentVariables["DSH_HOME"] = home;
            app.EnvironmentVariables["DSH_AGENTS_HOME"] = Path.Combine(home, "agents");
            app.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            app.EnvironmentVariables.Remove("NODE_OPTIONS");
            app.EnvironmentVariables.Remove("NODE_PATH");
            app.EnvironmentVariables["QCU_SUITE_SUPPORT"] = Path.Combine(root, "support");
            app.EnvironmentVariables["QCU_SUITE_LAUNCHER"] = Application.ExecutablePath;
            Process.Start(app);
        } catch (Exception e) {
            Failure(e.Message.StartsWith("QCU_TEACHER_ERROR:") ? e.Message : "[QCU-ST-1304] 启动或数据准备未完成。请完整解压到本地磁盘，确认目录可写；仍失败请联系维护人员。", checking);
        }
    }
}
