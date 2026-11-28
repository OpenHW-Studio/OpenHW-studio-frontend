import {
  saveProject,
  generateProjectId,
} from "../../../services/projectStore.js";
import { createSharedSimulation } from "../../../services/simulatorService.js";

/**
 * Share-dialog domain, extracted verbatim from SimulatorPage.jsx.
 * (cloud-sync placeholder, generate-share-url w/ save+snapshot+address-bar,
 *  share-dialog open w/ role gates, visibility/link-type resets,
 *  clipboard copy.)
 *
 * Behavior contract: identical justSharedRef dedup (entry loader skips
 * its own shareId), identical role-gate copy, identical snapshot/live
 * parentProjectId rule. Verify via share-dialog Playwright check.
 */
export function useShareDialog({
  currentProjectName,
  currentProjectIdRef,
  setCurrentProjectId,
  autoSaveTimerRef,
  getOwner,
  board,
  components,
  wires,
  code,
  blocklyXml,
  blocklyGeneratedCode,
  useBlocklyCode,
  projectFiles,
  openCodeTabs,
  activeCodeFileId,
  setCurrentProjectName,
  refreshProjectList,
  captureThumbnailRef,
  shareVisibility,
  setShareVisibility,
  shareLinkType,
  setShareLinkType,
  setShareUrl,
  setShareCopied,
  shareUrl,
  justSharedRef,
  navigate,
  setIsSharingSimulation,
  activeUser,
  isAnyAuthenticated,
  shareId,
  setShowShareDialog,
}) {
    // ─── Cloud Sync (placeholder) ───────────────────────────────────────────────
    const handleSyncToCloud = () => {
      alert("Sync feature coming soon!");
    };

    const handleGenerateShareUrl = async () => {
      setIsSharingSimulation(true);
      try {
        // 1. Save the project to Cloud & IndexedDB first
        const name = currentProjectName || "Untitled";
        const owner = getOwner();
        let id = currentProjectIdRef.current;
        if (!id) {
          id = generateProjectId();
          currentProjectIdRef.current = id;
          setCurrentProjectId(id);
        }
        clearTimeout(autoSaveTimerRef.current);
        const finalName = await saveProject({
          id,
          name,
          board,
          components,
          connections: wires,
          code,
          blocklyXml,
          blocklyGeneratedCode,
          useBlocklyCode,
          projectFiles,
          openCodeTabs,
          activeCodeFileId,
          owner,
        });
        setCurrentProjectName(finalName || name);
        await refreshProjectList();
        setTimeout(() => captureThumbnailRef.current?.(), 1500);

        // 2. Create the Shared Simulation snapshot with chosen visibility
        const response = await createSharedSimulation({
          name: finalName || name || "Untitled",
          isPublic: shareVisibility === "public",
          parentProjectId: shareLinkType === "live" ? id : "",
          board,
          components,
          connections: wires,
          code,
          projectFiles,
          openCodeTabs,
          activeCodeFileId,
        });

        const url = `${window.location.origin}/simulator/share/${response.shareId}`;
        setShareUrl(url);
        setShareCopied(false);

        // 3. Update browser address bar to the shared simulation link
        justSharedRef.current = response.shareId;
        navigate(`/simulator/share/${response.shareId}`);

        return url;
      } catch (error) {
        console.error("Failed to share simulation", error);
        alert(
          error?.response?.data?.message ||
          error.message ||
          "Failed to share simulation.",
        );
        return "";
      } finally {
        setIsSharingSimulation(false);
      }
    };

    const handleShareSimulation = async () => {
      console.log(
        "[SimulatorPage] handleShareSimulation - activeUser:",
        activeUser,
      );
      if (!["teacher", "user", "admin"].includes(activeUser?.role)) {
        alert("Only signed-in teachers and users can share simulator templates.");
        return;
      }

      if (!isAnyAuthenticated) {
        alert("Please sign in to share this simulation.");
        navigate("/login");
        return;
      }

      if (shareId) {
        setShareUrl(`${window.location.origin}/simulator/share/${shareId}`);
      } else {
        setShareUrl("");
      }
      setShareCopied(false);
      setShareVisibility("public");
      setShareLinkType("snapshot");
      setShowShareDialog(true);
    };

    const handleShareVisibilityChange = (val) => {
      setShareVisibility(val);
      setShareUrl("");
    };

    const handleShareLinkTypeChange = (val) => {
      setShareLinkType(val);
      setShareUrl("");
    };

    const handleCopyShareUrl = async () => {
      if (!shareUrl) return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
      } catch (error) {
        console.error("Failed to copy share URL", error);
        alert("Failed to copy share URL.");
      }
    };


  return {
    handleSyncToCloud,
    handleGenerateShareUrl,
    handleShareSimulation,
    handleShareVisibilityChange,
    handleShareLinkTypeChange,
    handleCopyShareUrl,
  };
}
