package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "13")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Hello, World!"))
	})

	fmt.Println("Listening on :8080")
	http.ListenAndServe(":8080", nil)
}
