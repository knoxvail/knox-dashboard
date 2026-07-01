import html2canvas from 'html2canvas';

/**
 * Capture screenshot of the main content area
 * Returns base64 encoded PNG image
 */
export async function captureScreenshot() {
  try {
    // Get the main content area (everything except sidebar and butte)
    const mainContent = document.querySelector('main') || document.body;

    const canvas = await html2canvas(mainContent, {
      allowTaint: true,
      useCORS: true,
      backgroundColor: '#030712', // gray-950
      scale: 1,
      logging: false,
    });

    // Convert to base64
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Screenshot failed:', error);
    throw new Error('Failed to capture screenshot');
  }
}
