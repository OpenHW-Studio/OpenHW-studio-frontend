import { CalendarDays, Home, Monitor, Settings } from "lucide-react";
import { getFilenameFromAssetUrl } from "./uploadUtils.js";

export const sidebarLinks = [
  { key: "home", label: "Home", icon: Home, route: "/teacher/dashboard" },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  {
    key: "simulator",
    label: "Open Simulator",
    icon: Monitor,
    route: "/simulator",
  },
  { key: "settings", label: "Settings", icon: Settings },
];

export const tabs = [
  { key: "stream", label: "Stream" },
  { key: "classwork", label: "Classwork" },
  { key: "people", label: "People" },
  { key: "marks", label: "Marks" },
];

export const pickAttachments = (item) => {
  if (Array.isArray(item?.attachments)) return item.attachments;
  if (Array.isArray(item?.files)) return item.files;
  return [];
};

export const isImageAttachment = (url) =>
  /^data:image\//i.test(url || "") ||
  /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url || "");

export const getAttachmentLabel = (url, index) => {
  const dataUrlName = getFilenameFromAssetUrl(url);
  if (dataUrlName) {
    return dataUrlName;
  }

  try {
    const parsedUrl = new URL(url);
    const fileName = parsedUrl.pathname.split("/").filter(Boolean).pop();
    if (fileName) return decodeURIComponent(fileName);
  } catch {
    // Todo
    // Fallback for non-URL or malformed values.
  }

  return `Link ${index + 1}`;
};
