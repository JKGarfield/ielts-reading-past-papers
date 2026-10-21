import Foundation
import Security
import Darwin

let account = "c4d213dc2d40b5a6466eac72cd47af6c"
let service = "codex.cloudflare.api-token"
let project = "jk-ielts-reading"

func fail(_ message: String) -> Never {
    fputs(message + "\n", stderr)
    exit(1)
}

// Do not forward Authorization to a redirect destination.
final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

func verify(_ token: String, productionOnly: Bool = false) -> Bool {
    let url = URL(string: "https://api.cloudflare.com/client/v4/accounts/\(account)/pages/projects/\(project)")!
    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 25
    let session = URLSession(configuration: .ephemeral, delegate: NoRedirect(), delegateQueue: nil)
    let done = DispatchSemaphore(value: 0)
    var valid = false
    session.dataTask(with: request) { data, response, error in
        defer { done.signal() }
        guard error == nil, let http = response as? HTTPURLResponse else {
            print("网络验证失败；未输出响应内容或 Token。")
            return
        }
        guard http.statusCode == 200, let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["success"] as? Bool == true,
              let result = json["result"] as? [String: Any],
              result["name"] as? String == project else {
            print("项目访问验证失败（HTTP \(http.statusCode)）。请检查账户范围和 Pages 权限。")
            return
        }
        if productionOnly && result["production_branch"] as? String != "main" {
            print("生产分支不是已确认的 main；已停止发布。")
            return
        }
        valid = true
        print("已验证可访问 Pages 项目：\(project)")
        if let branch = result["production_branch"] as? String {
            print("生产分支：\(branch)")
        }
        if let deployment = result["canonical_deployment"] as? [String: Any] {
            if let id = deployment["id"] as? String { print("生产部署 ID：\(id)") }
            if let metadata = deployment["deployment_trigger"] as? [String: Any],
               let values = metadata["metadata"] as? [String: Any],
               let commit = values["commit_hash"] as? String { print("生产源码版本：\(commit)") }
        }
        print("此验证只读取项目信息，不发布网站，也不证明拥有写权限。")
    }.resume()
    done.wait()
    session.invalidateAndCancel()
    return valid
}

let args = Array(CommandLine.arguments.dropFirst())
guard args == ["setup"] || args == ["verify"] || args == ["deploy"] || args == ["setup", "--replace"] else {
    print("用法：scripts/cloudflare-keychain.sh setup | verify | deploy | setup --replace")
    exit(args == ["--help"] ? 0 : 2)
}
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account
]

if args[0] == "verify" || args[0] == "deploy" {
    var read = query
    read[kSecReturnData as String] = true
    var item: CFTypeRef?
    let status = SecItemCopyMatching(read as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data,
          let token = String(data: data, encoding: .utf8) else {
        fail("无法读取钥匙串 Token（状态 \(status)），请先运行 setup 或允许钥匙串访问。")
    }
    guard verify(token, productionOnly: args[0] == "deploy") else { exit(1) }
    if args[0] == "verify" { exit(0) }

    func git(_ arguments: [String]) -> String {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        task.arguments = arguments
        let output = Pipe()
        task.standardOutput = output
        do { try task.run() } catch { fail("无法检查 Git 版本。") }
        let data = output.fileHandleForReading.readDataToEndOfFile()
        task.waitUntilExit()
        guard task.terminationStatus == 0 else { fail("Git 检查失败，未发布。") }
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    let root = FileManager.default.currentDirectoryPath
    guard git(["rev-parse", "--show-toplevel"]) == root,
          git(["branch", "--show-current"]) == "deploy/cloudflare-static" else { fail("当前目录或源码分支不符合本项目发布配置。") }
    let commit = git(["rev-parse", "HEAD"])
    guard git(["diff", "HEAD", "--name-only", "--", "src", "scripts", "package.json", "package-lock.json"]).isEmpty,
          git(["ls-files", "--others", "--exclude-standard", "--", "src", "scripts"]).isEmpty else { fail("请先提交源码与发布脚本，再重新构建。") }
    guard let data = FileManager.default.contents(atPath: root + "/dist/build-info.json"),
          let build = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          build["commit"] as? String == commit, build["mode"] as? String == "static",
          FileManager.default.fileExists(atPath: root + "/dist/index.html"),
          !FileManager.default.fileExists(atPath: root + "/dist/_worker.js"),
          !FileManager.default.fileExists(atPath: root + "/functions") else { fail("静态构建与当前提交不一致，或包含未授权的服务端层。") }
    print("发布目标：https://jk-ielts-reading.pages.dev；生产分支 main；仅上传 dist。")
    let upload = Process()
    upload.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    upload.arguments = ["npx", "--offline", "--yes", "wrangler@4.151.3", "pages", "deploy", "dist", "--project-name", project, "--branch", "main", "--commit-hash", commit, "--commit-dirty=false"]
    var environment = ProcessInfo.processInfo.environment
    environment["CLOUDFLARE_API_TOKEN"] = token
    environment["CLOUDFLARE_ACCOUNT_ID"] = account
    environment["WRANGLER_SEND_METRICS"] = "false"
    environment["CI"] = "true"
    upload.environment = environment
    do { try upload.run() } catch { fail("无法启动 Wrangler，凭据未输出。") }
    upload.waitUntilExit()
    exit(upload.terminationStatus)
}

guard isatty(STDIN_FILENO) == 1 else { fail("请在交互式终端运行 setup。") }
let existing = SecItemCopyMatching(query as CFDictionary, nil)
guard existing == errSecItemNotFound || existing == errSecSuccess else {
    fail("无法检查钥匙串（状态 \(existing)）。")
}
if existing == errSecSuccess && !args.contains("--replace") {
    fail("已有 Token；请运行 verify。需要主动替换时使用 setup --replace。")
}
print("粘贴 Cloudflare API Token 后回车；输入不会显示。不会进行部署。")
guard let pointer = getpass("Token: ") else { fail("未读取到输入。") }
let token = String(cString: pointer).trimmingCharacters(in: .whitespacesAndNewlines)
memset(pointer, 0, strlen(pointer))
guard !token.isEmpty, token.rangeOfCharacter(from: .whitespacesAndNewlines) == nil else {
    fail("Token 为空或包含空白字符。")
}
guard verify(token) else { fail("未保存 Token；修正后可重新运行 setup。") }
let data = Data(token.utf8)
let status: OSStatus
if existing == errSecSuccess {
    status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
} else {
    var add = query
    add[kSecValueData as String] = data
    add[kSecAttrLabel as String] = "Codex Cloudflare API Token"
    status = SecItemAdd(add as CFDictionary, nil)
}
guard status == errSecSuccess else { fail("保存失败（钥匙串状态 \(status)）。") }
print("已保存至 macOS 钥匙串。Token 未写入项目文件、命令参数或 shell 历史。")
