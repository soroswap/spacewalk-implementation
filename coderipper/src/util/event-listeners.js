import {
  parseEventRedeemExecution,
  parseEventIssueExecution,
} from "./event-parsers.js";

export class EventListener {
  static eventListeners = new Map();

  pendingIssueEvents = [];
  pendingRedeemEvents = [];

  api = undefined;

  constructor(api) {
    this.api = api;
    this.initEventSubscriber();
  }

  static getEventListener(api) {
    if (!this.eventListeners.has(api)) {
      const newListener = new EventListener(api);
      this.eventListeners.set(api, newListener);
    }
    return this.eventListeners.get(api);
  }

  async initEventSubscriber() {
    this.api.query.system.events((events) => {
      events.forEach((event) => {
        this.processEvents(event, this.pendingIssueEvents);
        this.processEvents(event, this.pendingRedeemEvents);
      });
    });
  }

  // We wrap two promises, with the inner creating by setTimeout rejecting if the max waiting time is achieved,
  // and the outer resolving and also clearing the timeout.
  waitForIssueExecuteEvent(issueId, maxWaitingTimeMs) {
    let filter = (event) => {
      if (
        event.event.section === "issue" &&
        event.event.method === "ExecuteIssue"
      ) {
        let eventParsed = parseEventIssueExecution(event);
        if (eventParsed.issueId == issueId) {
          return eventParsed;
        }
      }
      return null;
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Max waiting time exceeded for Issue Execution",
            issueId,
            "Issue Execution"
          )
        );
      }, maxWaitingTimeMs);

      this.pendingIssueEvents.push({
        filter,
        resolve: (event) => {
          clearTimeout(timeout);
          resolve(event);
        },
      });
    });
  }

  waitForRedeemExecuteEvent(redeemId, maxWaitingTimeMs) {
    let filter = (event) => {
      if (
        event.event.section === "redeem" &&
        event.event.method === "ExecuteRedeem"
      ) {
        let eventParsed = parseEventRedeemExecution(event);
        if (eventParsed.redeemId == redeemId) {
          return eventParsed;
        }
      }
      return null;
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Max waiting time exceeded for Redeem Execution",
            redeemId,
            "Redeem Execution"
          )
        );
      }, maxWaitingTimeMs);

      this.pendingRedeemEvents.push({
        filter,
        resolve: (event) => {
          clearTimeout(timeout);
          resolve(event);
        },
      });
    });
  }

  processEvents(event, pendingEvents) {
    pendingEvents.forEach((pendingEvent, index) => {
      const matchedEvent = pendingEvent.filter(event);

      if (matchedEvent) {
        pendingEvent.resolve(matchedEvent);
        pendingEvents.splice(index, 1);
      }
    });
  }
}
