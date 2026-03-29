import { uploadClassroomAssets } from "../../../services/classroomService.js";

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

const matchesAllowedType = (file, allowedTypes) =>
  allowedTypes.length === 0 ||
  allowedTypes.some(
    (allowedType) =>
      file.type === allowedType || file.type.startsWith(`${allowedType}/`),
  );

export const getFilenameFromAssetUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const normalizedUrl = value.startsWith("http")
      ? value
      : new URL(value, window.location.origin).toString();
    const parsedUrl = new URL(normalizedUrl);
    const fileName = parsedUrl.pathname.split("/").filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : "";
  } catch {
    return "";
  }
};

export const uploadClassroomFiles = async (
  fileList,
  {
    classId,
    category,
    maxFiles = 5,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    allowedTypes = [],
  } = {},
) => {
  const files = Array.from(fileList || []);

  if (!files.length) {
    return [];
  }

  if (files.length > maxFiles) {
    throw new Error(`You can upload up to ${maxFiles} files at a time.`);
  }

  files.forEach((file) => {
    if (file.size > maxFileSize) {
      throw new Error(
        `${file.name} is larger than ${Math.round(maxFileSize / (1024 * 1024))}MB.`,
      );
    }

    if (!matchesAllowedType(file, allowedTypes)) {
      throw new Error(`${file.name} is not a supported file type.`);
    }
  });

  const uploaded = await uploadClassroomAssets({
    files,
    category,
    classId,
  });

  return uploaded.map((file) => file.url);
};
