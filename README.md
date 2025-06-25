# Sofie iNews-FTP Gateway

An application for piping data between [**Sofie Server Core**](https://github.com/nrkno/tv-automation-server-core) and iNews via an **HTTP proxy gateway** (no longer direct FTP).

This application is a part of the [**Sofie** TV News Studio Automation System](https://github.com/nrkno/Sofie-TV-automation/).

## Usage

```BASH
// Development:
yarn start -host 127.0.0.1 -port 3000 -log "log.log"
// Production:
yarn start
```

## Setup

After starting the gateway, go to the Sofie settings, you should find an option for `INEWS GATEWAY`.

**Note:** The gateway now communicates with iNews through an HTTP proxy service (not direct FTP). Ensure your HTTP proxy endpoint is accessible and configured.

Under hosts, add the HTTP proxy endpoint(s) for your iNews servers. Then add the queue names for each iNews queue you want to ingest into Sofie, e.g. `INEWS.QUEUE.ON-AIR`.

Going back to the Sofie Rundowns view, your queues will appear as rundowns.

**CLI arguments:**

| Argument | Description            | Environment variable |
| -------- | ---------------------- | -------------------- |
| -host    | Hostname or IP of Core | CORE_HOST            |
| -port    | Port of Core           | CORE_PORT            |
| -log     | Path to output log     | CORE_LOG             |
| -proxy   | HTTP proxy endpoint    | INEWS_HTTP_PROXY     |

## Installation for dev

yarn

yarn build

### Dev dependencies

- yarn:
  <https://yarnpkg.com>

- jest:
  `yarn global add jest`
