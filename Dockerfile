# Use a pristine, pinned Node.js 20 Ubuntu environment (Clean Room)
FROM node:20-bullseye

# Set the working directory
WORKDIR /usr/src/ohnrscript

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Run a clean install (npm ci) to guarantee no local cache contamination
RUN npm ci

# Copy the rest of the framework and benchmark files
COPY . .

# Ensure the execution script has proper permissions
RUN chmod +x run-cleanroom-benchmarks.sh

# The default command when spinning up the container
CMD ["./run-cleanroom-benchmarks.sh"]
