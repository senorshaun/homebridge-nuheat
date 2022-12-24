    //Builds SignalR connection. SignalR connection hub is called  - "notificationsHost".
    //So full connection url should always be "baseUrl/notificationsHost".
const signalR = require("@microsoft/signalr");

module.exports = class NuHeatListener {
    constructor(accesstoken, nuheatPlatform) {
        this.accesstoken = accesstoken;
        this.nuHeatPlatform = nuheatPlatform;
        this.log = nuheatPlatform.log;
        this.notificationTypes = ["2","4"]  //Subscribe to thermostat and group notifications

        this.connection = new signalR.HubConnectionBuilder().withUrl("https://api.mynuheat.com/notificationsHost?token=" + this.accesstoken).build();

    };

    connect(){

        //Start new connection.
        this.connection.start().then(() => {
            this.log.debug('Notification listener connection started!');
            //Subscribe for notifications after connections starts.
            this.connection.invoke("Subscribe", this.notificationTypes).then(() => {
                this.log.debug('Subscribed for notifications');
            })
            .catch(err => {this.log.error('Error subscribing to notifications:' + err.toString());
            });
        })
        .catch(err => {this.log.error('Error starting notification listener connection:' + err.toString());
        });
     
        //Handle notifications. The only callback that can be invoked on the client side is called - "Notify".
        this.connection.on("Notify", (value) => {
            this.traceNotification(value);
        });

    };

    disconnect(){
        //Close connection.
        //If notification tracking is not needed anymore then connection should be closed, and it's safe to close connection without unsubscribing from what is currently tracking.
        this.connection.stop()
        .then(() => {
            this.log.debug('Notification connection stopped!');
        })
        .catch(err => {this.log.debug("Error closing notification listener connection: " + err.toString());
        });
    };

    unsubscribe(){
        //Unsubscribe from notifications. Please remember that amount of "unsubscribe" calls should be equal to amount of "subscribe" calls
        this.connection.invoke("Unsubscribe", this.notificationTypes).then(() => {
            this.log.debug('Unsubscribed from notifications');
        })
        .catch(err => {this.log.error("Error unsubscribing from notifications: " + err.toString());
        });
    };


    traceNotification(notificationList) {
        notificationList.forEach(function (notification) {
            var notificationType = "";
            switch (notification.type) {
                case 0:
                    notificationType = "UserAccount";
                    break;
                case 1:
                    notificationType = "UserAccount";
                    break;
                case 2:
                    notificationType = "Thermostat";
                    this.nuHeatPlatform.refreshThermostats();
                    break;
                case 3:
                    notificationType = "Schedule";
                    break;
                case 4:
                    notificationType = "Group";
                    this.nuHeatPlatform.refreshGroups();
                break;
            }
            var traceMessage = notificationType + ' notification for item ' + notification.id + " at " + notification.timeStamp + ". Refreshing data for all " + notificationType + "s";
            this.log.debug(traceMessage);
        });
    };
}