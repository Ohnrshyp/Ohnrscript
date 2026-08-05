const std = @import("std");
const net = std.net;

fn handleConnection(connection: net.Server.Connection) void {
    defer connection.stream.close();
    var buffer: [2048]u8 = undefined;
    
    while (true) {
        const bytes_read = connection.stream.read(&buffer) catch return;
        if (bytes_read == 0) return;
        
        _ = connection.stream.writeAll(
            "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: keep-alive\r\n\r\nHello, World!"
        ) catch return;
    }
}

pub fn main() !void {
    const address = try net.Address.parseIp("127.0.0.1", 8080);
    var server = try address.listen(.{ .reuse_address = true });
    defer server.deinit();
    
    std.debug.print("Listening on :8080\n", .{});

    while (true) {
        const connection = try server.accept();
        const thread = std.Thread.spawn(.{}, handleConnection, .{connection}) catch continue;
        thread.detach();
    }
}
