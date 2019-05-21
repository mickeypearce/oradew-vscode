import TelemetryReporter from "vscode-extension-telemetry";

const pkgJson = require("../package.json");

// all events will be prefixed with this event name
const extensionId = pkgJson.name;

// extension version will be reported as a property with each event
const extensionVersion = pkgJson.version;

// the application insights key (also known as instrumentation key)
const key = "864f39be-f021-4e3b-98fb-18690e2e7066";

export class Telemetry {
  public static reporter: TelemetryReporter;

  public static initialize() {
    Telemetry.reporter = new TelemetryReporter(
      extensionId,
      extensionVersion,
      key
    );
  }

  public static sendEvent = (
    eventName: string,
    properties?: any,
    measurements?: any
  ) => {
    try {
      Telemetry.reporter.sendTelemetryEvent(
        eventName,
        properties,
        measurements
      );
    } catch {}
  }

  public static deactivate() {
    Telemetry.reporter.dispose();
  }
}

Telemetry.initialize();
