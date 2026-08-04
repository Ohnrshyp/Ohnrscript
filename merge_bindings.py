import sys
import re

node_bindings_path = "/Users/jordankugler/Cursor/ORBIT/ohnrscript/packages-llvm/node.ohn/src/bindings.c"
tls_bindings_path = "/Users/jordankugler/Cursor/ORBIT/ohnrscript/packages-llvm/tls.ohn/src/bindings.c"

with open(node_bindings_path, "r") as f:
    node_content = f.read()

with open(tls_bindings_path, "r") as f:
    tls_content = f.read()

tls_code = tls_content.split("/* ============================================================\n * 9. TLS (mbedTLS) ZERO-ALLOCATION BRIDGE")[1]
tls_code = "/* ============================================================\n * 10. TLS (mbedTLS) ZERO-ALLOCATION BRIDGE" + tls_code

# We need to change sys_tls_connect to accept is_server
tls_code = tls_code.replace(
    "int64_t sys_tls_connect(int32_t slot, int32_t fd, int64_t hostname_ptr) {",
    "int64_t sys_tls_connect(int32_t slot, int32_t fd, int64_t hostname_ptr, int32_t is_server) {"
)

# And configure mbedtls_ssl_setup with a different config if it's a client
# Wait, we can just use conf for server and a new conf_client for client.
# Let's add conf_client to sys_tls_init.
init_search = "mbedtls_ssl_config_defaults(&conf,"
init_replace = """mbedtls_ssl_config_defaults(&conf,
                                MBEDTLS_SSL_IS_SERVER,
                                MBEDTLS_SSL_TRANSPORT_STREAM,
                                MBEDTLS_SSL_PRESET_DEFAULT);

    mbedtls_ssl_config_init(&conf_client);
    mbedtls_ssl_config_defaults(&conf_client,
                                MBEDTLS_SSL_IS_CLIENT,
                                MBEDTLS_SSL_TRANSPORT_STREAM,
                                MBEDTLS_SSL_PRESET_DEFAULT);
    mbedtls_ssl_conf_min_tls_version(&conf_client, MBEDTLS_SSL_VERSION_TLS1_2);
    mbedtls_ssl_conf_authmode(&conf_client, MBEDTLS_SSL_VERIFY_NONE); // Relaxed for local dev

    // We will still allow sni and certs on client config if needed, or leave it basic.
"""
tls_code = tls_code.replace("mbedtls_ssl_config conf;", "mbedtls_ssl_config conf;\nmbedtls_ssl_config conf_client;")
tls_code = tls_code.replace(
    """    mbedtls_ssl_config_defaults(&conf,
                                MBEDTLS_SSL_IS_SERVER,
                                MBEDTLS_SSL_TRANSPORT_STREAM,
                                MBEDTLS_SSL_PRESET_DEFAULT);""",
    init_replace
)

setup_search = "mbedtls_ssl_setup(ssl, &conf);"
setup_replace = "mbedtls_ssl_setup(ssl, is_server ? &conf : &conf_client);"
tls_code = tls_code.replace(setup_search, setup_replace)

new_content = node_content + "\n\n" + tls_code

with open(node_bindings_path, "w") as f:
    f.write(new_content)
