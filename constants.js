const chooseServiceQuickReply = [
  {
    content_type: "text",
    title: "Food Delivery",
    payload: "Food Delivery",
  },
  {
    content_type: "text",
    title: "Grocery",
    payload: "Grocery",
  },
  {
    content_type: "text",
    title: "Ride",
    payload: "Ride",
  },
  {
    content_type: "text",
    title: "Package Delivery",
    payload: "Package Delivery",
  },
];

const cancelOrderUserQuickReply = [
  {
    content_type: "text",
    title: "Cancel Order",
    payload: "Cancel Order",
  },
];

const driverOrderConvoQuickReply = [
  {
    content_type: "text",
    title: "Order Delivered",
    payload: "Order Delivered",
  },
  {
    content_type: "text",
    title: "Cancel Order",
    payload: "Cancel Order",
  },
];

const driverPackageConvoQuickReply = [
  {
    content_type: "text",
    title: "Package Delivered",
    payload: "Package Delivered",
  },
  {
    content_type: "text",
    title: "Cancel Order",
    payload: "Cancel Order",
  },
];

const driverRideConvoQuickReply = [
  {
    content_type: "text",
    title: "Passenger Delivered",
    payload: "Passenger Delivered",
  },
  {
    content_type: "text",
    title: "Cancel Order",
    payload: "Cancel Order",
  },
];

const userOrderDeliveredQuickReply = [
  {
    content_type: "text",
    title: "Order Received",
    payload: "Order Received",
  },
  {
    content_type: "text",
    title: "Must be a mistake",
    payload: "Must be a mistake",
  },
];

const userRideCompletedQuickReply = [
  {
    content_type: "text",
    title: "Ride Completed",
    payload: "Ride Completed",
  },
  {
    content_type: "text",
    title: "Must be a mistake",
    payload: "Must be a mistake",
  },
];

const userPackageReceivedQuickReply = [
  {
    content_type: "text",
    title: "Package Received",
    payload: "Ride Completed",
  },
  {
    content_type: "text",
    title: "Must be a mistake",
    payload: "Must be a mistake",
  },
];

module.exports = {
  chooseServiceQuickReply,
  cancelOrderUserQuickReply,
  driverOrderConvoQuickReply,
  driverRideConvoQuickReply,
  userOrderDeliveredQuickReply,
  userRideCompletedQuickReply,
  userPackageReceivedQuickReply,
  driverPackageConvoQuickReply,
};
