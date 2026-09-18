using System;
using System.Diagnostics;
using System.IO;

class PixyLauncher {
    static int Main(string[] args) {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string scriptPath = Path.Combine(appDir, "dist", "index.js");

        if (!File.Exists(scriptPath)) {
            scriptPath = Path.Combine(appDir, "index.js");
        }

        if (!File.Exists(scriptPath)) {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Error: dist/index.js tidak ditemukan di: " + appDir);
            Console.ResetColor();
            return 1;
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "node";
        
        string arguments = "\"" + scriptPath + "\"";
        foreach (string arg in args) {
            arguments += " \"" + arg.Replace("\"", "\\\"") + "\"";
        }
        
        psi.Arguments = arguments;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = false;

        try {
            using (Process process = Process.Start(psi)) {
                process.WaitForExit();
                return process.ExitCode;
            }
        } catch (Exception ex) {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Error menjalankan Node.js: " + ex.Message);
            Console.WriteLine("Pastikan Node.js sudah terpasang di sistem Anda (https://nodejs.org).");
            Console.ResetColor();
            return 1;
        }
    }
}
