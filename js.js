// DOM Elements for input fields
const batchCropX = document.getElementById('batchCropX');
const batchCropY = document.getElementById('batchCropY');
const batchCropW = document.getElementById('batchCropW');
const batchCropH = document.getElementById('batchCropH');

const profileCropX = document.getElementById('profileCropX');
const profileCropY = document.getElementById('profileCropY');
const profileCropW = document.getElementById('profileCropW');
const profileCropH = document.getElementById('profileCropH');

const combineColsInput = document.getElementById('combineCols');
const combineRowsInput = document.getElementById('combineRows'); // Corrected this line previously

// Preview Canvas for batch images
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
let previewImage_batch = new Image();
let currentBatchImageOriginalWidth = 0; // Store original width for scaling
let currentBatchImageOriginalHeight = 0; // Store original height for scaling

// Profile Canvas for profile image
const profileCanvas = document.getElementById('profileCanvas');
const profileCtx = profileCanvas.getContext('2d');
let previewImage_profile = new Image();
let currentProfileImageOriginalWidth = 0; // Store original width for scaling
let currentProfileImageOriginalHeight = 0; // Store original height for scaling

let croppedProfileImage = null; // Store the cropped profile image object

const inputProfileImage = document.getElementById('inputProfileImage');
const croppedImagesContainer = document.getElementById('croppedImagesContainer');
const finalOutputCanvas = document.getElementById('finalOutputCanvas');
const finalOutputCtx = finalOutputCanvas.getContext('2d');

let allCroppedBatchImages = []; // Stores ALL successfully cropped Image objects (for combining)
let croppedFilesData = {}; // Stores {fileName: dataURL} for batch cropped images (for ZIP)

// --- GLOBAL CANVAS RENDER MAX WIDTH ---
const CANVAS_RENDER_MAX_WIDTH = 500; // Max pixels for canvas display (adjust as needed for typical desktop)


// --- Event Listeners for Canvas Interaction and Input Updates ---
function setupCanvasInteraction(canvas, ctx, image, inputX, inputY, inputW, inputH, originalWidth, originalHeight) {
    let dragging = false, startX_canvas = 0, startY_canvas = 0;

    // Scale factors should be calculated based on the canvas's current *drawing* dimensions
    // and the original image dimensions.
    let scaleFactorX = canvas.width / originalWidth;
    let scaleFactorY = canvas.height / originalHeight;

    // This function will be called initially and whenever inputs change
    const updateScaleFactorsAndRedraw = () => {
        // Recalculate scale factors in case canvas dimensions were externally changed (though they shouldn't be now)
        scaleFactorX = canvas.width / originalWidth;
        scaleFactorY = canvas.height / originalHeight;
        drawCurrentRect("green");
    };

    function canvasToOriginalCoords(x_canvas, y_canvas) {
        return {
            x: Math.round(x_canvas / scaleFactorX),
            y: Math.round(y_canvas / scaleFactorY)
        };
    }

    function originalToCanvasCoords(x_orig, y_orig, w_orig, h_orig) {
        return {
            x: Math.round(x_orig * scaleFactorX),
            y: Math.round(y_orig * scaleFactorY),
            w: Math.round(w_orig * scaleFactorX),
            h: Math.round(h_orig * scaleFactorY)
        };
    }

    function getCanvasCoordsFromEvent(e) {
        // Use offsetLeft/offsetTop of the canvas to get its position relative to the document
        // And adjust for scrolling if any
        const rect = canvas.getBoundingClientRect(); // Get size and position of canvas relative to viewport
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: Math.round(clientX - rect.left), // X relative to canvas
            y: Math.round(clientY - rect.top)  // Y relative to canvas
        };
    }

    function drawCurrentRect(color = "red") {
        if (!image || !image.src || image.naturalWidth === 0 || image.naturalHeight === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const rectCanvas = originalToCanvasCoords(
            parseInt(inputX.value) || 0,
            parseInt(inputY.value) || 0,
            parseInt(inputW.value) || 0,
            parseInt(inputH.value) || 0
        );

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(rectCanvas.x, rectCanvas.y, rectCanvas.w, rectCanvas.h);
    }

    [inputX, inputY, inputW, inputH].forEach(input => {
        input.addEventListener('input', () => {
            let val = parseInt(input.value) || 0;
            input.value = Math.max(0, val);

            let currentX = parseInt(inputX.value) || 0;
            let currentY = parseInt(inputY.value) || 0;
            let currentW = parseInt(inputW.value) || 0;
            let currentH = parseInt(inputH.value) || 0;

            if (currentX + currentW > originalWidth) {
                if (input === inputW) input.value = Math.max(0, originalWidth - currentX);
                else if (input === inputX) input.value = Math.max(0, originalWidth - currentW);
            }
            if (currentY + currentH > originalHeight) {
                if (input === inputH) input.value = Math.max(0, originalHeight - currentY);
                else if (input === inputY) input.value = Math.max(0, originalHeight - currentW);
            }

            drawCurrentRect("green");
        });
    });

    canvas.addEventListener('mousedown', e => {
        if (!image || !image.src || image.naturalWidth === 0 || image.naturalHeight === 0) return;
        const pos = getCanvasCoordsFromEvent(e);
        startX_canvas = pos.x;
        startY_canvas = pos.y;
        dragging = true;
    });

    canvas.addEventListener('mousemove', e => {
        if (!dragging) return;
        const pos = getCanvasCoordsFromEvent(e);

        const currentOriginalX = Math.min(startX_canvas, pos.x);
        const currentOriginalY = Math.min(startY_canvas, pos.y);
        const currentOriginalW = Math.abs(pos.x - startX_canvas);
        const currentOriginalH = Math.abs(pos.y - startY_canvas);

        const originalCoords = canvasToOriginalCoords(currentOriginalX, currentOriginalY);
        const originalDims = canvasToOriginalCoords(currentOriginalW, currentOriginalH);

        inputX.value = Math.max(0, Math.min(originalCoords.x, originalWidth));
        inputY.value = Math.max(0, Math.min(originalCoords.y, originalHeight));
        inputW.value = Math.max(0, Math.min(originalDims.x, originalWidth - (parseInt(inputX.value) || 0)));
        inputH.value = Math.max(0, Math.min(originalDims.y, originalHeight - (parseInt(inputY.value) || 0)));


        drawCurrentRect("red");
    });

    canvas.addEventListener('mouseup', e => {
        dragging = false;
        const pos = getCanvasCoordsFromEvent(e);

        const finalOriginalX_canvas = Math.min(startX_canvas, pos.x);
        const finalOriginalY_canvas = Math.min(startY_canvas, pos.y);
        const finalOriginalW_canvas = Math.abs(pos.x - startX_canvas);
        const finalOriginalH_canvas = Math.abs(pos.y - startY_canvas);

        const originalCoords = canvasToOriginalCoords(finalOriginalX_canvas, finalOriginalY_canvas);
        const originalDims = canvasToOriginalCoords(finalOriginalW_canvas, finalOriginalH_canvas);

        inputX.value = Math.max(0, Math.min(originalCoords.x, originalWidth));
        inputY.value = Math.max(0, Math.min(originalCoords.y, originalHeight));
        inputW.value = Math.max(0, Math.min(originalDims.x, originalWidth - (parseInt(inputX.value) || 0)));
        inputH.value = Math.max(0, Math.min(originalDims.y, originalHeight - (parseInt(inputY.value) || 0)));

        drawCurrentRect("green");
    });

    canvas.addEventListener('touchstart', e => {
        if (!image || !image.src || image.naturalWidth === 0 || image.naturalHeight === 0) return;
        e.preventDefault();
        const pos = getCanvasCoordsFromEvent(e);
        startX_canvas = pos.x;
        startY_canvas = pos.y;
        dragging = true;
    });

    canvas.addEventListener('touchmove', e => {
        if (!dragging) return;
        e.preventDefault();
        const pos = getCanvasCoordsFromEvent(e);

        const currentOriginalX = Math.min(startX_canvas, pos.x);
        const currentOriginalY = Math.min(startY_canvas, pos.y);
        const currentOriginalW = Math.abs(pos.x - startX_canvas);
        const currentOriginalH = Math.abs(pos.y - startY_canvas);

        const originalCoords = canvasToOriginalCoords(currentOriginalX, currentOriginalY);
        const originalDims = canvasToOriginalCoords(currentOriginalW, currentOriginalH);

        inputX.value = Math.max(0, Math.min(originalCoords.x, originalWidth));
        inputY.value = Math.max(0, Math.min(originalCoords.y, originalHeight));
        inputW.value = Math.max(0, Math.min(originalDims.x, originalWidth - (parseInt(inputX.value) || 0)));
        inputH.value = Math.max(0, Math.min(originalDims.y, originalHeight - (parseInt(inputY.value) || 0)));

        drawCurrentRect("red");
    });

    canvas.addEventListener('touchend', e => {
        dragging = false;
        const pos = getCanvasCoordsFromEvent(e.changedTouches[0]);

        const finalOriginalX_canvas = Math.min(startX_canvas, pos.x);
        const finalOriginalY_canvas = Math.min(startY_canvas, pos.y);
        const finalOriginalW_canvas = Math.abs(pos.x - startX_canvas);
        const finalOriginalH_canvas = Math.abs(pos.y - startY_canvas);

        const originalCoords = canvasToOriginalCoords(finalOriginalX_canvas, finalOriginalY_canvas);
        const originalDims = canvasToOriginalCoords(finalOriginalW_canvas, finalOriginalH_canvas);

        inputX.value = Math.max(0, Math.min(originalCoords.x, originalWidth));
        inputY.value = Math.max(0, Math.min(originalCoords.y, originalHeight));
        inputW.value = Math.max(0, Math.min(originalDims.x, originalWidth - (parseInt(inputX.value) || 0)));
        inputH.value = Math.max(0, Math.min(originalDims.y, originalHeight - (parseInt(inputY.value) || 0)));

        drawCurrentRect("green");
    });
    return drawCurrentRect;
}

let drawBatchRect;
let drawProfileRect;

// Hàm set canvas preview luôn full width
function setCanvasFullWidth(canvas, image) {
  const containerWidth = canvas.parentElement.offsetWidth || window.innerWidth;
  const aspectRatio = image.naturalWidth / image.naturalHeight;
  canvas.width = containerWidth;
  canvas.height = containerWidth / aspectRatio;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  // Bỏ min-h/max-h khi đã có ảnh
  canvas.classList.remove('min-h-32', 'max-h-64', 'bg-gray-100');
}

// Khi chưa có ảnh, giữ min-h/max-h/bg như cũ
function resetCanvasPlaceholder(canvas, colorClass) {
  canvas.width = 0;
  canvas.height = 0;
  canvas.style.width = '100%';
  canvas.style.height = '';
  canvas.classList.add('min-h-32', 'max-h-64', 'bg-gray-100');
  if (colorClass) {
    canvas.classList.add(colorClass);
  }
}

document.getElementById('inputImages').addEventListener('change', async function() {
    if (!this.files.length) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        currentBatchImageOriginalWidth = 0;
        currentBatchImageOriginalHeight = 0;
        resetCanvasPlaceholder(previewCanvas, 'border-green-300');
        return;
    }
    const file = this.files[0];
    const dataURL = await fileToDataURL(file);
    previewImage_batch.src = dataURL;
    previewImage_batch.onload = () => {
        currentBatchImageOriginalWidth = previewImage_batch.naturalWidth;
        currentBatchImageOriginalHeight = previewImage_batch.naturalHeight;
        setCanvasFullWidth(previewCanvas, previewImage_batch);
        if (parseInt(batchCropW.value) === 0 || parseInt(batchCropH.value) === 0 || parseInt(batchCropW.value) > currentBatchImageOriginalWidth || parseInt(batchCropH.value) > currentBatchImageOriginalHeight) {
            batchCropX.value = 0;
            batchCropY.value = 0;
            batchCropW.value = Math.min(currentBatchImageOriginalWidth, 100);
            batchCropH.value = Math.min(currentBatchImageOriginalHeight, 100);
        }
        drawBatchRect = setupCanvasInteraction(previewCanvas, previewCtx, previewImage_batch, batchCropX, batchCropY, batchCropW, batchCropH, currentBatchImageOriginalWidth, currentBatchImageOriginalHeight);
        drawBatchRect("green");
    };
    previewImage_batch.onerror = () => {
        alert("Không thể tải ảnh hàng loạt đầu tiên để hiển thị. Vui lòng kiểm tra file ảnh.");
        resetCanvasPlaceholder(previewCanvas, 'border-green-300');
    };
});

inputProfileImage.addEventListener('change', async function() {
    if (!this.files.length) {
        profileCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
        currentProfileImageOriginalWidth = 0;
        currentProfileImageOriginalHeight = 0;
        croppedProfileImage = null;
        resetCanvasPlaceholder(profileCanvas, 'border-blue-300');
        return;
    }
    const file = this.files[0];
    const dataURL = await fileToDataURL(file);
    previewImage_profile.src = dataURL;
    previewImage_profile.onload = () => {
        currentProfileImageOriginalWidth = previewImage_profile.naturalWidth;
        currentProfileImageOriginalHeight = previewImage_profile.naturalHeight;
        setCanvasFullWidth(profileCanvas, previewImage_profile);
        if (parseInt(profileCropW.value) === 0 || parseInt(profileCropH.value) === 0 || parseInt(profileCropW.value) > currentProfileImageOriginalWidth || parseInt(profileCropH.value) > currentProfileImageOriginalHeight) {
            profileCropX.value = 0;
            profileCropY.value = 0;
            profileCropW.value = currentProfileImageOriginalWidth;
            profileCropH.value = currentProfileImageOriginalHeight;
        }
        drawProfileRect = setupCanvasInteraction(profileCanvas, profileCtx, previewImage_profile, profileCropX, profileCropY, profileCropW, profileCropH, currentProfileImageOriginalWidth, currentProfileImageOriginalHeight);
        drawProfileRect("green");
    };
    previewImage_profile.onerror = () => {
        alert("Không thể tải ảnh profile. Vui lòng kiểm tra file ảnh.");
        resetCanvasPlaceholder(profileCanvas, 'border-blue-300');
    };
});

function showLoadingOverlay(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) overlay.classList.remove('hidden');
  else overlay.classList.add('hidden');
}
function showLoadingOverlayGhep(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }

async function processAndShowCroppedImages() {
    showLoadingOverlay(true); // Show loading at the start of the whole process
    try {
        finalOutputCanvas.style.display = 'none';
        document.getElementById('downloadCombinedImage').style.display = 'none';
        finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCtx.height);

        console.log("Bắt đầu quá trình cắt ảnh...");

        // Ẩn các phần preview cũ
        const croppedPreviewSection = document.getElementById('croppedPreviewSection');
        croppedPreviewSection.classList.add('hidden'); // Ẩn toàn bộ phần preview
        const croppedProfileImg = document.getElementById('croppedProfileImg');
        croppedProfileImg.classList.add('hidden');
        croppedImagesContainer.innerHTML = ''; // Clear previous batch images
        croppedImagesContainer.style.display = 'none'; // Ẩn container ảnh batch

        // 1. Crop profile image first
        if (!previewImage_profile.src || previewImage_profile.naturalWidth === 0 || previewImage_profile.naturalHeight === 0) {
            alert('Vui lòng tải ảnh profile trước khi cắt.');
            return;
        }
        croppedProfileImage = await cropProfileImage();
        if (!croppedProfileImage) {
            return; // Dừng nếu cắt profile lỗi
        }
        // Hiển thị ảnh profile đã cắt
        croppedProfileImg.src = croppedProfileImage.src;
        croppedProfileImg.className = 'rounded border-2 border-blue-400 shadow-lg w-28 h-auto mb-1 transition-transform duration-200 hover:scale-105';
        croppedProfileImg.classList.remove('hidden');
        const profileCroppedWidth = croppedProfileImage.naturalWidth;
        const profileCroppedHeight = croppedProfileImage.naturalHeight;
        console.log(`Ảnh profile đã cắt có kích thước: ${profileCroppedWidth}x${profileCroppedHeight}`);

        // 2. Calculate batch image target dimensions based on cropped profile image
        const batchTargetWidth = Math.floor(profileCroppedWidth / 2);
        const batchTargetHeight = Math.floor(profileCroppedHeight / 2);
        console.log(`Ảnh hàng loạt sẽ được cắt và đổi kích thước thành khung: ${batchTargetWidth}x${batchTargetHeight}`);

        const inputBatchFiles = document.getElementById('inputImages').files;
        if (inputBatchFiles.length === 0) {
            alert("Vui lòng tải ảnh gốc để cắt hàng loạt trước khi cắt.");
            console.error("Lỗi: Không có ảnh hàng loạt nào được chọn.");
            return;
        }
        if (!previewImage_batch.src || previewImage_batch.naturalWidth === 0 || previewImage_batch.naturalHeight === 0) {
             alert("Ảnh đầu tiên của hàng loạt chưa được tải hoặc bị lỗi. Vui lòng thử tải lại các ảnh hàng loạt.");
             console.error("Lỗi: Ảnh batch preview chưa tải.");
             return;
        }

        // 3. Prepare for progressive display: show the container for batch images
        croppedPreviewSection.classList.remove('hidden');
        croppedImagesContainer.style.display = 'flex'; // Make the flex container visible

        // 4. Crop and display batch images progressively
        const cropSuccess = await cropBatchImages(inputBatchFiles, batchTargetWidth, batchTargetHeight);

        if (!cropSuccess) {
            console.error("Không thể cắt ảnh hàng loạt. Dừng quá trình.");
            // Hide containers again if batch crop fails entirely
            croppedImagesContainer.style.display = 'none';
            croppedPreviewSection.classList.add('hidden');
            showLoadingOverlay(false); // Hide overlay if batch crop fails early
            return;
        }

        console.log("Hoàn thành quá trình cắt ảnh. Tất cả ảnh đã cắt sẵn sàng để ghép.");
        // showLoadingOverlay(false) is now called by the last image's setTimeout in cropBatchImages
    } catch (error) {
        console.error("Lỗi tổng quát trong quá trình cắt ảnh:", error);
        alert("Đã xảy ra lỗi trong quá trình cắt ảnh. Vui lòng kiểm tra console để biết chi tiết.");
        showLoadingOverlay(false); // Ensure overlay hides on any error
    }
}

async function cropProfileImage() {
    const x = parseInt(profileCropX.value);
    const y = parseInt(profileCropY.value);
    const w = parseInt(profileCropW.value);
    const h = parseInt(profileCropH.value);

    console.log(`Cắt ảnh profile: X=${x}, Y=${y}, W=${w}, H=${h} (dựa trên kích thước gốc)`);

    if (!previewImage_profile.src || w <= 0 || h <= 0 || x + w > previewImage_profile.naturalWidth || y + h > previewImage_profile.naturalHeight) {
        alert('Vui lòng tải và chọn vùng cắt cho ảnh profile hợp lệ (chiều rộng/cao > 0 và nằm trong ảnh).');
        console.error("Lỗi: Thông tin cắt ảnh profile không hợp lệ.");
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(previewImage_profile, x, y, w, h, 0, 0, w, h);

    const croppedImg = new Image();
    croppedImg.src = canvas.toDataURL("image/png");
    await new Promise(resolve => croppedImg.onload = resolve);
    console.log(`Ảnh profile đã cắt thành công: ${croppedImg.naturalWidth}x${croppedImg.naturalHeight}`);
    return croppedImg;
}

// Modified to accept targetWidth and targetHeight for batch images
async function cropBatchImages(files, batchTargetWidth, batchTargetHeight) {
    allCroppedBatchImages = [];
    croppedFilesData = {};

    const x_batch = parseInt(batchCropX.value);
    const y_batch = parseInt(batchCropY.value);
    const w_batch = parseInt(batchCropW.value); // Kích thước vùng cắt trên ảnh gốc
    const h_batch = parseInt(batchCropH.value); // Kích thước vùng cắt trên ảnh gốc

    console.log(`Bắt đầu cắt ảnh hàng loạt. Vùng cắt gốc: X=${x_batch}, Y=${y_batch}, W=${w_batch}, H=${h_batch}. Kích thước khung đích: ${batchTargetWidth}x${batchTargetHeight}`);

    if (files.length === 0) {
        alert('Không có ảnh nào được chọn để cắt hàng loạt.');
        console.error("Lỗi: Không có ảnh gốc để cắt hàng loạt.");
        return false;
    }
    if (w_batch <= 0 || h_batch <= 0 || x_batch + w_batch > currentBatchImageOriginalWidth || y_batch + h_batch > currentBatchImageOriginalHeight) {
        alert('Chiều rộng và chiều cao vùng cắt ảnh hàng loạt phải lớn hơn 0 và nằm trong ảnh preview đầu tiên.');
        console.error("Lỗi: Kích thước vùng cắt ảnh hàng loạt không hợp lệ hoặc nằm ngoài ảnh preview.");
        return false;
    }
    if (batchTargetWidth <= 0 || batchTargetHeight <= 0) {
        alert('Kích thước ảnh cắt hàng loạt (từ ảnh profile) không hợp lệ. Đảm bảo ảnh profile có kích thước hợp lệ.');
        console.error("Lỗi: Kích thước đích cho ảnh hàng loạt không hợp lệ.");
        return false;
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const img = new Image();
        try {
            const dataURL = await fileToDataURL(file);
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    // Kiểm tra xem vùng cắt có nằm trong ảnh gốc hay không
                    if (x_batch + w_batch > img.naturalWidth || y_batch + h_batch > img.naturalHeight) {
                        console.warn(`Vùng cắt cho ảnh "${file.name}" nằm ngoài giới hạn ảnh gốc (${img.naturalWidth}x${img.naturalHeight}). Bỏ qua ảnh này.`);
                        resolve(); // Bỏ qua ảnh này và tiếp tục với ảnh tiếp theo
                        return;
                    }

                    const canvas = document.createElement('canvas');
                    // Set canvas dimensions directly to batchTargetWidth and batchTargetHeight
                    canvas.width = batchTargetWidth;
                    canvas.height = batchTargetHeight;
                    const ctx = canvas.getContext('2d');

                    // Xóa canvas trước khi vẽ để đảm bảo nền trong suốt
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Vẽ vùng ảnh đã cắt lên canvas đích, STRETCHING it to fill the target dimensions
                    // This will ensure no transparent padding inside the cropped batch images
                    ctx.drawImage(img, x_batch, y_batch, w_batch, h_batch, 0, 0, batchTargetWidth, batchTargetHeight);

                    const croppedDataURL = canvas.toDataURL("image/png");
                    const fileName = 'cropped_' + file.name.replace(/\.[^/.]+$/, "") + '.png';

                    croppedFilesData[fileName] = croppedDataURL;

                    const wrap = document.createElement('div');
                    wrap.className = 'cropped-image-wrapper relative flex flex-col items-center opacity-0 transition-opacity duration-300'; // Start with opacity 0
                    wrap.dataset.fileName = fileName;
                    wrap.dataset.originalIndex = i; // Store original index if needed

                    const imgPreview = new Image();
                    imgPreview.src = croppedDataURL;
                    imgPreview.onload = () => {
                        allCroppedBatchImages.push(imgPreview); // Add to ALL cropped images
                        updateZipDownloadLink();

                        // Append, then trigger fade-in and scroll
                        croppedImagesContainer.appendChild(wrap);
                        const delay = 50 * (i + 1); // Reduced delay for faster appearance
                        setTimeout(() => {
                            wrap.style.opacity = '1'; // Fade in
                            // Scroll to the newly added image, ensuring it's visible
                            wrap.scrollIntoView({ behavior: 'smooth', block: 'end' });

                            // Hide loading overlay after the last image has appeared and scrolled
                            if (i === files.length - 1) {
                                console.log(`Ảnh cuối cùng đã hiển thị. Ẩn loading overlay.`);
                                setTimeout(() => showLoadingOverlay(false), 50); // Add a small buffer after the last scroll
                            }
                        }, delay);
                        resolve();
                    };
                    imgPreview.onerror = () => { resolve(); }
                    imgPreview.className = 'rounded border border-green-300 shadow w-24 h-auto mb-1';
                    wrap.appendChild(imgPreview);
                    // Nút X
                    const removeButton = document.createElement('button');
                    removeButton.className = 'absolute -top-2 -right-2 bg-red-100 hover:bg-red-500 text-red-700 hover:text-white border border-red-300 rounded-full w-6 h-6 flex items-center justify-center shadow transition-all duration-200';
                    removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
                    removeButton.onclick = (e) => {
                        e.stopPropagation();
                        removeCroppedImage(wrap, fileName, imgPreview);
                    };
                    wrap.appendChild(removeButton);
                    // Do not append here, append within setTimeout after onload
                };
                img.onerror = () => { resolve(); };
                img.src = dataURL;
            });
        } catch (error) {
            console.error(`Lỗi xử lý ảnh "${file.name}":`, error);
        }
    }
    return true;
}

function removeCroppedImage(element, fileName, imageObjectToRemove) {
    console.log(`Đang xóa ảnh đã cắt: ${fileName}`);
    element.remove();
    delete croppedFilesData[fileName];

    const index = allCroppedBatchImages.indexOf(imageObjectToRemove);
    if (index > -1) {
        allCroppedBatchImages.splice(index, 1);
    }

    console.log(`Tổng số ảnh hàng loạt còn lại sau khi xóa: ${allCroppedBatchImages.length}`);
    updateZipDownloadLink();
}

async function combineImages() {
    // 1. Initial validation checks (these should happen *before* showing the loading overlay)
    if (!croppedProfileImage || croppedProfileImage.naturalWidth === 0 || croppedProfileImage.naturalHeight === 0) {
        alert('Vui lòng cắt ảnh profile trước khi ghép. Ảnh profile có thể bị lỗi hoặc chưa tải.');
        return;
    }
    if (allCroppedBatchImages.length === 0) {
        alert('Vui lòng cắt ít nhất một ảnh hàng loạt để ghép.');
        return;
    }
    const itemsPerRow = parseInt(document.getElementById('combineCols').value);
    const numRows = parseInt(document.getElementById('combineRows').value);
    if (itemsPerRow < 2 || numRows < 2) {
        alert('Số cột và số hàng để ghép phải ít nhất là 2.');
        return;
    }

    // 2. ONLY show loading overlay if all initial validations pass
    showLoadingOverlayGhep(true);

    try {
        finalOutputCanvas.style.display = 'none';
        document.getElementById('downloadCombinedImage').style.display = 'none';
        // Corrected: Use finalOutputCanvas.height for clearRect
        finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCtx.height);

        const profileCroppedWidth = croppedProfileImage.naturalWidth;
        const profileCroppedHeight = croppedProfileImage.naturalHeight;
        const batchImageWidth = Math.floor(profileCroppedWidth / 2);
        const batchImageHeight = Math.floor(profileCroppedHeight / 2);

        await drawCombinedImage(profileCroppedWidth, profileCroppedHeight, batchImageWidth, batchImageHeight, allCroppedBatchImages, itemsPerRow, numRows);

        // Sau khi vẽ xong, show ảnh ra modal popup
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        // Lấy dataURL từ canvas và show vào modal
        modalImg.src = finalOutputCanvas.toDataURL('image/png');
        modal.style.display = 'flex'; // Use flex to show the modal (for proper centering)
        // Hiện nút tải ảnh ghép trong modal
        const downloadBtn = document.getElementById('downloadCombinedImage');
        downloadBtn.style.display = 'block';
        downloadBtn.href = finalOutputCanvas.toDataURL('image/png');
        downloadBtn.download = 'combined_image.png';
    } catch (error) {
        console.error("Lỗi trong quá trình ghép ảnh:", error);
        alert("Đã xảy ra lỗi trong quá trình ghép ảnh. Vui lòng kiểm tra console để biết chi tiết.");
    } finally {
        showLoadingOverlayGhep(false); // Ẩn lớp phủ loading khi hoàn tất (dù thành công hay lỗi)
    }
}

async function drawCombinedImage(profileOriginalWidth, profileOriginalHeight, batchImageWidth, batchImageHeight, imagesToUse, itemsPerRow, numRows) {
    console.log("Bắt đầu hàm drawCombinedImage với bố cục mới.");
    console.log(`Số ảnh hàng loạt thực tế sẽ được dùng: ${imagesToUse.length}`);

    finalOutputCanvas.style.display = 'none';
    document.getElementById('downloadCombinedImage').style.display = 'none';
    finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCtx.height);

    // Thêm đoạn này để điền màu trắng cho nền của canvas cuối cùng
    finalOutputCtx.fillStyle = 'white';
    finalOutputCtx.fillRect(0, 0, finalOutputCanvas.width, finalOutputCanvas.height);

    // Calculate canvas dimensions
    const canvasWidth = Math.round(batchImageWidth * itemsPerRow);
    let totalCanvasHeight = 0;

    // Row 1 height (1 hàng ảnh batch)
    totalCanvasHeight += Math.round(batchImageHeight);
    // Row 2 height (ảnh profile cao bằng 2 ảnh batch)
    totalCanvasHeight += Math.round(batchImageHeight * 2);
    // Remaining rows height (numRows - 2 hàng ảnh batch còn lại)
    if (numRows > 2) {
        totalCanvasHeight += Math.round((numRows - 2) * batchImageHeight);
    }

    finalOutputCanvas.width = canvasWidth;
    finalOutputCanvas.height = totalCanvasHeight;
    // Đảm bảo kích thước hiển thị của canvas khớp với kích thước vẽ
    finalOutputCanvas.style.width = `${canvasWidth}px`;
    finalOutputCanvas.style.height = `${totalCanvasHeight}px`;

    let currentX = 0;
    let currentY = 0;
    let imageIndex = 0; // Initialize image counter for imagesToUse array

    // Draw Row 1: Full row of batch images
    console.log("Vẽ hàng 1 (Batch Images)");
    for (let col = 0; col < itemsPerRow; col++) {
        if (imageIndex < imagesToUse.length) {
            const batchImage = imagesToUse[imageIndex];
            if (batchImage && batchImage.naturalWidth > 0 && batchImage.naturalHeight > 0) {
                finalOutputCtx.drawImage(batchImage, Math.round(currentX), Math.round(currentY), Math.round(batchImageWidth), Math.round(batchImageHeight));
            } else {
                console.warn(`Ảnh hàng loạt ở index ${imageIndex} chưa tải/lỗi hoặc null (hàng 1, cột ${col}), bỏ qua và để ô trống.`);
            }
            currentX += batchImageWidth;
            imageIndex++;
        } else {
            console.log(`Hết ảnh để ghép. Tổng số ô được điền: ${imageIndex}.`);
            break;
        }
    }
    currentY += batchImageHeight; // Move Y position down for next row
    console.log(`Đã vẽ hàng 1. Vị trí Y tiếp theo: ${currentY}. Ảnh đã sử dụng: ${imageIndex}`);

    // Draw Row 2: Profile Image + Batch Images (ghepnho)
    console.log("Vẽ hàng 2 (Profile + Ghepnho Batch Images)");
    const profileDisplayWidth = Math.round(batchImageWidth * 2); // Profile takes 2 columns width
    const profileDisplayHeight = Math.round(batchImageHeight * 2); // Profile takes 2 rows height (of batch images)

    // Draw Profile Image
    if (croppedProfileImage && croppedProfileImage.naturalWidth > 0 && croppedProfileImage.naturalHeight > 0) {
        finalOutputCtx.drawImage(croppedProfileImage, 0, Math.round(currentY), profileDisplayWidth, profileDisplayHeight);
        console.log(`Đã vẽ ảnh profile tại (0, ${Math.round(currentY)}) với kích thước ${profileDisplayWidth}x${profileDisplayHeight}`);
    } else {
        console.warn("Ảnh profile không khả dụng để vẽ vào hàng 2.");
    }

    // Draw batch images in Row 2 (right side - "ghepnho")
    const batchStartX = profileDisplayWidth;
    const batchColsInRow2 = itemsPerRow - 2; // Number of batch images columns in the "ghepnho" section

    // --- Ghepnho - Hàng 1 (Upper part of Row 2) ---
    let tempCurrentX = batchStartX;
    console.log(`Vẽ Ghepnho - Hàng 1 (Upper part of Row 2) từ Y=${currentY}`);
    for (let col = 0; col < batchColsInRow2; col++) {
        if (imageIndex < imagesToUse.length) {
            const img = imagesToUse[imageIndex];
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                finalOutputCtx.drawImage(img, Math.round(tempCurrentX), Math.round(currentY), Math.round(batchImageWidth), Math.round(batchImageHeight));
            } else {
                console.warn(`Ảnh hàng loạt ở index ${imageIndex} chưa tải/lỗi hoặc null (ghepnho hàng 1, cột ${col}), bỏ qua.`);
            }
            tempCurrentX += batchImageWidth;
            imageIndex++;
        } else {
            console.log(`Hết ảnh để ghép (ghepnho hàng 1). Tổng số ô được điền: ${imageIndex}.`);
            break;
        }
    }

    // --- Ghepnho - Hàng 2 (Lower part of Row 2) ---
    tempCurrentX = batchStartX; // Reset X for the second sub-row
    const tempCurrentY_row2_lower = currentY + batchImageHeight; // Y position for the lower part
    console.log(`Vẽ Ghepnho - Hàng 2 (Lower part of Row 2) từ Y=${tempCurrentY_row2_lower}`);
    for (let col = 0; col < batchColsInRow2; col++) {
        if (imageIndex < imagesToUse.length) {
            const img = imagesToUse[imageIndex];
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                finalOutputCtx.drawImage(img, Math.round(tempCurrentX), Math.round(tempCurrentY_row2_lower), Math.round(batchImageWidth), Math.round(batchImageHeight));
            } else {
                console.warn(`Ảnh hàng loạt ở index ${imageIndex} chưa tải/lỗi hoặc null (ghepnho hàng 2, cột ${col}), bỏ qua.`);
            }
            tempCurrentX += batchImageWidth;
            imageIndex++;
        } else {
            console.log(`Hết ảnh để ghép (ghepnho hàng 2). Tổng số ô được điền: ${imageIndex}.`);
            break;
        }
    }

    currentY += profileDisplayHeight; // Move Y position down (profile height)
    console.log(`Đã vẽ hàng 2. Vị trí Y tiếp theo: ${currentY}.`);

    // Draw Remaining Rows: Full rows of Batch Images
    console.log("Vẽ các hàng còn lại (Batch Images)");
    for (let row = 2; row < numRows; row++) { // Start from row 2 (0-indexed) means the third conceptual row
        currentX = 0; // Reset X for each new row
        for (let col = 0; col < itemsPerRow; col++) {
            if (imageIndex < imagesToUse.length) {
                const img = imagesToUse[imageIndex];
                if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                    finalOutputCtx.drawImage(img, Math.round(currentX), Math.round(currentY), Math.round(batchImageWidth), Math.round(batchImageHeight));
                } else {
                    console.warn(`Ảnh hàng loạt ở index ${imageIndex} chưa tải/lỗi hoặc null (hàng ${row + 1}, cột ${col}), bỏ qua và để ô trống.`);
                }
                currentX += batchImageWidth;
                imageIndex++;
            } else {
                console.log(`Hết ảnh để ghép. Tổng số ô được điền: ${imageIndex}.`);
                break;
            }
        }
        currentY += batchImageHeight;
    }
    console.log(`Hoàn thành vẽ tất cả ảnh. Tổng số ảnh đã sử dụng: ${imageIndex}`);

    finalOutputCanvas.style.display = 'block';
    document.getElementById('downloadCombinedImage').style.display = 'block';
    document.getElementById('downloadCombinedImage').href = finalOutputCanvas.toDataURL("image/png");
    document.getElementById('downloadCombinedImage').download = "combined_image.png";
}

function updateZipDownloadLink() {
    // Không làm gì nữa, vì không còn tải zip
    const zipLink = document.getElementById('downloadAll');
    if (zipLink) zipLink.style.display = 'none';
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Hàm hiển thị ảnh cắt ra trong popup
function showImageInModal(imageSrc) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  modalImg.src = imageSrc;
  modal.style.display = 'flex'; // Use flex to show the modal and apply centering styles
  console.log('Popup hiển thị ảnh đã được mở.');
}

// Đóng modal khi bấm nút close hoặc click ra ngoài
function setupModalEvents() {
  const modal = document.getElementById('imageModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const modalImg = document.getElementById('modalImage');

  if (closeBtn) {
    closeBtn.onclick = () => {
      console.log("Nút đóng popup (X) đã được click. Đang ẩn popup.");
      modal.style.display = 'none';
      if (modalImg) modalImg.src = '';
    };
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        console.log("Click vào nền popup. Đang ẩn popup.");
        modal.style.display = 'none';
        if (modalImg) modalImg.src = '';
      }
    };
  }
}

// --- HƯỚNG DẪN SỬ DỤNG MODAL ---
document.addEventListener('DOMContentLoaded', () => {
    setupModalEvents(); // Gắn sự kiện cho modal popup ngay khi DOM sẵn sàng
    setupGuideModalEvents();
    showGuideModalOnFirstLoad();
    console.log('DOM đã sẵn sàng, các sự kiện modal đã được thiết lập.');
});

function setupGuideModalEvents() {
  const guideModal = document.getElementById('guideModal');
  const closeGuideBtn = document.getElementById('closeGuideBtn');
  const openGuideBtn = document.getElementById('openGuideBtn');

  if (closeGuideBtn) {
    closeGuideBtn.onclick = () => {
      guideModal.style.display = 'none';
    };
  }
  if (openGuideBtn) {
    openGuideBtn.onclick = () => {
      guideModal.style.display = 'flex';
    };
  }
  // Không cho phép đóng bằng click ra ngoài hoặc phím ESC
  if (guideModal) {
    guideModal.onclick = (e) => {
      if (e.target === guideModal) {
        // Không làm gì cả
      }
    };
  }
  document.addEventListener('keydown', function(e) {
    if (guideModal.style.display !== 'none' && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
    }
  });
}

function showGuideModalOnFirstLoad() {
  const guideModal = document.getElementById('guideModal');
  if (guideModal) {
    guideModal.style.display = 'flex';
  }
}