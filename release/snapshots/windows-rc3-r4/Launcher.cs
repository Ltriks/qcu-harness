// MIT. A native Windows entry point; does not alter the vendor application.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Launcher {
    private static string Quote(string value) { return "\"" + value + "\""; }
    [STAThread]
    private static void Main(string[] args) {
        bool checking = args.Length == 1 && args[0] == "--prepare-only";
        string root = AppDomain.CurrentDomain.BaseDirectory;
        try {
            string executable = Path.Combine(root, "program", "DeepSeek Harness.exe");
            string bootstrap = Path.Combine(root, "support", "start.cjs");
            if (!File.Exists(executable) || !File.Exists(bootstrap))
                throw new Exception("请先解压整个文件夹，再打开QCU助手。请勿单独移动此启动文件。");
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
                if (child.ExitCode != 0) throw new Exception(errors.Length == 0 ? output : errors);
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
            Process.Start(app);
        } catch (Exception e) {
            if (checking) {
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "qcu-teacher-launcher-check-error.txt"), e.ToString(), Encoding.UTF8);
                Environment.ExitCode = 1;
                return;
            }
            MessageBox.Show("QCU助手暂时未能打开。\n\n" + e.Message +
                "\n\n请将此提示发给维护人员，已有数据会保留。", "QCU助手", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
