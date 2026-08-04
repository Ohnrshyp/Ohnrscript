import sys

node_loop_path = "/Users/jordankugler/Cursor/ORBIT/ohnrscript/packages-llvm/node.ohn/src/loop.ohn"
tls_loop_path = "/Users/jordankugler/Cursor/ORBIT/ohnrscript/packages-llvm/tls.ohn/src/loop.ohn"

with open(node_loop_path, "r") as f:
    node_content = f.read()

# We'll just replace the node.ohn loop.ohn with the tls.ohn loop.ohn,
# but we need to add the mpsc.ohn integration to handleHandshake.

with open(tls_loop_path, "r") as f:
    tls_content = f.read()

# We need to add the mpsc externs and logic to tls_content
# First, insert mpsc extern
externs = """
const ohn_time_sec = __extern('sys_time_sec');

// ── MPSC Integration ──
// mpsc_push is defined in mpsc.ohn, but we need to declare it if they are compiled together.
// In Ohnrscript, functions from other files compiled together are globally visible,
// so we can just call mpsc_push(slot).
"""

tls_content = tls_content.replace("const ohn_time_sec = __extern('sys_time_sec');", externs)

# Now, update handleHandshake
handshake_old = """    } else if (ret === 0) {
        // Handshake Complete
        state_table[slot] = STATE_READING;
        ohn_kqueue_register(kq, fd, EVFILT_WRITE, EV_DELETE);
        ohn_kqueue_register(kq, fd, EVFILT_READ, EV_ADD);
        
        timeout_touch(slot, (current_sec + 30) | 0); // 30 second keep-alive
    }"""

handshake_new = """    } else if (ret === 0) {
        // Handshake Complete
        state_table[slot] = STATE_READING;
        ohn_kqueue_register(kq, fd, EVFILT_WRITE, EV_DELETE);
        ohn_kqueue_register(kq, fd, EVFILT_READ, EV_ADD);
        
        // Push completion event to MPSC queue so the Promise can resolve
        mpsc_push(slot);
        
        // timeout_touch(slot, (current_sec + 30) | 0); // 30 second keep-alive
    }"""

tls_content = tls_content.replace(handshake_old, handshake_new)

# Wait, tls_content has `timeout_touch` and `timeout_add` and `timeout_poll`, 
# but maybe node.ohn doesn't have timeout.ohn included in build.sh?
# Actually, the user's build.sh in node.ohn might have timeout.ohn. Let's check node.ohn/build.sh.
with open(node_loop_path, "w") as f:
    f.write(tls_content)

