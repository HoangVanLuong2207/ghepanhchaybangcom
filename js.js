// DOM Elements for input fields
const profileCropX = document.getElementById('profileCropX');
const profileCropY = document.getElementById('profileCropY');
const profileCropW = document.getElementById('profileCropW');
const profileCropH = document.getElementById('profileCropH');

const combineColsInput = document.getElementById('combineCols');
const combineRowsInput = document.getElementById('combineRows'); // Corrected this line previously

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
  if (overlay) {
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }
}
function showLoadingOverlayGhep(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }

async function processAndShowCroppedImages() {
    showLoadingOverlay(true);
    try {
        if (!finalOutputCanvas || !finalOutputCtx) {
            alert('Thiếu canvas xuất ảnh (finalOutputCanvas). Kiểm tra lại id trong HTML.');
            showLoadingOverlay(false);
            return;
        }
        finalOutputCanvas.style.display = 'none';
        const downloadBtn = document.getElementById('downloadCombinedImage');
        if (downloadBtn) downloadBtn.style.display = 'none';
        finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCanvas.height);

        // Ẩn các phần preview cũ
        const croppedPreviewSection = document.getElementById('croppedPreviewSection');
        if (croppedPreviewSection) croppedPreviewSection.classList.add('hidden');
        const croppedProfileImg = document.getElementById('croppedProfileImg');
        if (croppedProfileImg) croppedProfileImg.classList.add('hidden');
        if (croppedImagesContainer) {
            croppedImagesContainer.innerHTML = '';
            croppedImagesContainer.style.display = 'none';
        }

        // 1. Crop profile image only
        if (!previewImage_profile.src || previewImage_profile.naturalWidth === 0 || previewImage_profile.naturalHeight === 0) {
            alert('Vui lòng tải ảnh profile trước khi cắt.');
            showLoadingOverlay(false);
            return;
        }
        croppedProfileImage = await cropProfileImage();
        if (!croppedProfileImage) {
            showLoadingOverlay(false);
            return;
        }
        // Hiển thị ảnh profile đã cắt
        if (croppedProfileImg) {
            croppedProfileImg.src = croppedProfileImage.src;
            croppedProfileImg.className = 'rounded border-2 border-blue-400 shadow-lg w-28 h-auto mb-1 transition-transform duration-200 hover:scale-105';
            croppedProfileImg.classList.remove('hidden');
        }
        if (croppedPreviewSection) croppedPreviewSection.classList.remove('hidden');
        showLoadingOverlay(false);
    } catch (error) {
        alert('Đã xảy ra lỗi trong quá trình cắt ảnh. Vui lòng kiểm tra lại bố cục HTML và id các phần tử.');
        showLoadingOverlay(false);
    }
}

async function cropProfileImage() {
    const x = parseInt(profileCropX.value);
    const y = parseInt(profileCropY.value);
    const w = parseInt(profileCropW.value);
    const h = parseInt(profileCropH.value);

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
                        if (croppedImagesContainer) {
                            croppedImagesContainer.appendChild(wrap);
                        }
                        const delay = 50 * (i + 1); // Reduced delay for faster appearance
                        setTimeout(() => {
                            wrap.style.opacity = '1'; // Fade in
                            // Scroll to the newly added image, ensuring it's visible
                            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'end' });

                            // Hide loading overlay after the last image has appeared and scrolled
                            if (i === files.length - 1) {
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
    if (element) element.remove();
    if (croppedFilesData) delete croppedFilesData[fileName];

    const index = allCroppedBatchImages.indexOf(imageObjectToRemove);
    if (index > -1) {
        allCroppedBatchImages.splice(index, 1);
    }

    console.log(`Tổng số ảnh hàng loạt còn lại sau khi xóa: ${allCroppedBatchImages.length}`);
    updateZipDownloadLink();
}

async function combineImages() {
    if (!croppedProfileImage || croppedProfileImage.naturalWidth === 0 || croppedProfileImage.naturalHeight === 0) {
        alert('Vui lòng cắt ảnh profile trước khi ghép. Ảnh profile có thể bị lỗi hoặc chưa tải.');
        return;
    }
    if (!selectedSkinImages || selectedSkinImages.length === 0) {
        alert('Vui lòng chọn ít nhất một ảnh skin để ghép.');
        return;
    }
    const itemsPerRow = parseInt(document.getElementById('combineCols').value);
    const numRows = parseInt(document.getElementById('combineRows').value);
    if (itemsPerRow < 2 || numRows < 2) {
        alert('Số cột và số hàng để ghép phải ít nhất là 2.');
        return;
    }
    showLoadingOverlayGhep(true);
    try {
        finalOutputCanvas.style.display = 'none';
        document.getElementById('downloadCombinedImage').style.display = 'none';
        finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCtx.height);

        // Load all selected skin images as Image objects
        const skinImageObjs = await Promise.all(selectedSkinImages.map(imgData => {
            return new Promise(resolve => {
                const img = new window.Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = imgData.url;
            });
        }));
        // Lọc bỏ ảnh lỗi
        const validSkinImages = skinImageObjs.filter(img => img && img.naturalWidth > 0 && img.naturalHeight > 0);
        if (validSkinImages.length === 0) {
            alert('Không có ảnh skin nào hợp lệ để ghép.');
            showLoadingOverlayGhep(false);
            return;
        }
        const profileCroppedWidth = croppedProfileImage.naturalWidth;
        const profileCroppedHeight = croppedProfileImage.naturalHeight;
        const batchImageWidth = Math.floor(profileCroppedWidth / 2);
        const batchImageHeight = Math.floor(profileCroppedHeight / 2);
        await drawCombinedImage(profileCroppedWidth, profileCroppedHeight, batchImageWidth, batchImageHeight, validSkinImages, itemsPerRow, numRows);
        // Show modal
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        modalImg.src = finalOutputCanvas.toDataURL('image/png');
        modal.style.display = 'flex';
        const downloadBtn = document.getElementById('downloadCombinedImage');
        downloadBtn.style.display = 'block';
        downloadBtn.href = finalOutputCanvas.toDataURL('image/png');
        downloadBtn.download = 'combined_image.png';
    } catch (error) {
        console.error('Lỗi trong quá trình ghép ảnh:', error);
        alert('Đã xảy ra lỗi trong quá trình ghép ảnh. Vui lòng kiểm tra console để biết chi tiết.');
    } finally {
        showLoadingOverlayGhep(false);
    }
}

async function drawCombinedImage(profileOriginalWidth, profileOriginalHeight, batchImageWidth, batchImageHeight, imagesToUse, itemsPerRow, numRows) {
    finalOutputCanvas.style.display = 'none';
    document.getElementById('downloadCombinedImage').style.display = 'none';
    finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCtx.height);

    // Thêm đoạn này để điền màu trắng cho nền của canvas cuối cùng
    finalOutputCtx.fillStyle = 'white';
    finalOutputCtx.fillRect(0, 0, finalOutputCanvas.width, finalOutputCanvas.height);

    // Lấy giá trị các item
    const gtsValue = parseInt(document.getElementById('gts').value) || 0;
    const gsValue = parseInt(document.getElementById('gs').value) || 0;
    const dtkValue = parseInt(document.getElementById('dtk').value) || 0;
    const tdtValue = document.getElementById('tdt').value.trim(); // Lấy text thay vì number
    const qhValue = parseInt(document.getElementById('qh').value) || 0;

    // Tạo danh sách items có giá trị được nhập
    const items = [];
    if (gtsValue > 0) items.push({name: 'Giấy tuyệt sắc', value: gtsValue, color: '#FF6B6B'});
    if (gsValue > 0) items.push({name: 'Giấy S', value: gsValue, color: '#4ECDC4'});
    if (dtkValue > 0) items.push({name: 'Đá thời không', value: dtkValue, color: '#45B7D1'});
    if (tdtValue !== '') items.push({name: 'Thẻ đổi tên', value: tdtValue, color: '#FFD93D'}); // Kiểm tra text không rỗng
    if (qhValue > 0) items.push({name: 'Quân huy', value: qhValue, color: '#6C5CE7'});

    // Tạo ảnh profile mới với items bar
    let newProfileImage = croppedProfileImage;
    if (items.length > 0) {
        newProfileImage = await createProfileWithItems(croppedProfileImage, items);
    }

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
            break;
        }
    }
    currentY += batchImageHeight; // Move Y position down for next row

    // Draw Row 2: Profile Image + Batch Images (ghepnho)
    const profileDisplayWidth = Math.round(batchImageWidth * 2); // Profile takes 2 columns width
    const profileDisplayHeight = Math.round(batchImageHeight * 2); // Profile takes 2 rows height (of batch images)

    // Draw Profile Image (sử dụng ảnh profile mới)
    if (newProfileImage && newProfileImage.naturalWidth > 0 && newProfileImage.naturalHeight > 0) {
        finalOutputCtx.drawImage(newProfileImage, 0, Math.round(currentY), profileDisplayWidth, profileDisplayHeight);
    } else {
        console.warn("Ảnh profile không khả dụng để vẽ vào hàng 2.");
    }

    // Draw batch images in Row 2 (right side - "ghepnho")
    const batchStartX = profileDisplayWidth;
    const batchColsInRow2 = itemsPerRow - 2; // Number of batch images columns in the "ghepnho" section

    // --- Ghepnho - Hàng 1 (Upper part of Row 2) ---
    let tempCurrentX = batchStartX;
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
            break;
        }
    }

    // --- Ghepnho - Hàng 2 (Lower part of Row 2) ---
    tempCurrentX = batchStartX; // Reset X for the second sub-row
    const tempCurrentY_row2_lower = currentY + batchImageHeight; // Y position for the lower part
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
            break;
        }
    }

    currentY += profileDisplayHeight; // Move Y position down (profile height)

    // Draw Remaining Rows: Full rows of Batch Images
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
                break;
            }
        }
        currentY += batchImageHeight;
    }

    // NOTE: Đây là chỗ chỉnh kích thước viền vàng - thay đổi borderWidth ở đây
    const borderWidth = 10; // ← CHỈNH KÍCH THƯỚC VIỀN VÀNG Ở ĐÂY
    
    // Vẽ viền vàng gold cho ảnh ghép cuối cùng
    finalOutputCtx.strokeStyle = '#FFDF00'; // Màu vàng gold
    finalOutputCtx.lineWidth = borderWidth;
    finalOutputCtx.strokeRect(borderWidth/2, borderWidth/2, finalOutputCanvas.width - borderWidth, finalOutputCanvas.height - borderWidth);
    
    finalOutputCanvas.style.display = 'block';
    document.getElementById('downloadCombinedImage').style.display = 'block';
    document.getElementById('downloadCombinedImage').href = finalOutputCanvas.toDataURL("image/png");
    document.getElementById('downloadCombinedImage').download = "combined_image.png";
}

// Hàm tạo ảnh profile mới với items bar
async function createProfileWithItems(originalProfileImage, items) {
    console.log('Bắt đầu createProfileWithItems với items:', items);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const profileWidth = originalProfileImage.naturalWidth;
    const profileHeight = originalProfileImage.naturalHeight;
    
    console.log('Kích thước profile:', profileWidth, 'x', profileHeight);
    
    // Vị trí Y cho items bar = cuối ảnh profile - chiều cao items bar
    const itemBarHeight = Math.round(profileWidth / 5); // Chiều cao = 1/5 chiều ngang của items bar
    
    canvas.width = profileWidth;
    canvas.height = profileHeight; // Không tăng chiều cao nữa, items bar sẽ overlay
    
    console.log('Canvas size:', canvas.width, 'x', canvas.height);
    console.log('Item bar height:', itemBarHeight);
    
    // Vẽ background trắng
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Vẽ ảnh profile gốc
    ctx.drawImage(originalProfileImage, 0, 0, profileWidth, profileHeight);
    
    // Load ảnh items
    const itemImages = {};
    const imageNames = {
        'Giấy tuyệt sắc': 'gts.jpeg',
        'Giấy S': 'gs.jpeg',
        'Đá thời không': 'dtk.jpeg',
        'Thẻ đổi tên': 'tdt.jpg',
        'Quân huy': 'qh.jpeg'
    };
    
    // Load tất cả ảnh items
    for (const [itemName, imageName] of Object.entries(imageNames)) {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Thêm crossOrigin để tránh lỗi CORS
            img.src = imageName;
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    itemImages[itemName] = img; 
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Không thể load ảnh: ${imageName}`);
                    resolve(); // Không reject, chỉ warn
                };
                // Timeout sau 3 giây
                setTimeout(() => {
                    console.warn(`Timeout loading ảnh: ${imageName}`);
                    resolve();
                }, 3000);
            });
        } catch (error) {
            console.warn(`Lỗi load ảnh ${imageName}:`, error);
        }
    }
    
    // Chỉ ghép những items có giá trị được nhập
    if (items.length > 0) {
        console.log('Có', items.length, 'items để vẽ');
        const itemWidth = Math.round(profileWidth / 5); // Chia đều cho 5 ô
        
        items.forEach((item, index) => {
            console.log('Vẽ item:', item.name, 'với giá trị:', item.value);
            const itemX = index * itemWidth;
            
            // Vị trí Y cho items bar = cuối ảnh profile - chiều cao items bar
            const itemBarHeight = Math.round(profileWidth / 5); // Chiều cao = 1/5 chiều ngang của items bar
            const itemBarY = profileHeight - itemBarHeight;
            
            console.log('Item position:', itemX, itemBarY);
            
            // Vẽ item nhỏ chỉ bao trùm text (không có phần trên dưới)
            const smallItemSize = itemWidth; // Kích thước item = 100% chiều rộng item slot
            const smallItemX = itemX; // Bắt đầu từ đầu item slot
            const smallItemY = itemBarY; // Bắt đầu từ đầu item bar
            
            console.log('Small item position:', smallItemX, smallItemY, 'size:', smallItemSize);
            
            // Vẽ ảnh background cho item nhỏ TRƯỚC
            const itemImage = itemImages[item.name];
            console.log('Item image for', item.name, ':', itemImage ? 'loaded' : 'not loaded');
            if (itemImage && itemImage.complete && itemImage.naturalWidth > 0) {
                try {
                    ctx.drawImage(itemImage, smallItemX, smallItemY, smallItemSize, smallItemSize);
                    console.log('Đã vẽ ảnh cho', item.name);
                } catch (error) {
                    console.warn(`Lỗi vẽ ảnh ${item.name}:`, error);
                    // Fallback: vẽ background màu xám nhạt
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(smallItemX, smallItemY, smallItemSize, smallItemSize);
                }
            } else {
                // Fallback: vẽ background màu xám nhạt nếu không có ảnh
                console.log('Vẽ fallback cho', item.name);
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(smallItemX, smallItemY, smallItemSize, smallItemSize);
            }
            
            // Vẽ số lượng ở góc dưới phải
            const quantitySize = Math.round(itemWidth / 5); // Kích thước = 1/5 chiều ngang item
            const quantityX = itemX + itemWidth - quantitySize - 20; // Sát bên phải, cách lề 5px
            const quantityY = itemBarY + itemBarHeight - quantitySize -2; // Sát dưới, cách lề 5px
            
            // Tự động điều chỉnh font size dựa trên số chữ số
            const valueStr = item.value.toString();
            let fontSize = 40; // Font size mặc định
            
            if (valueStr.length == 2) {
                fontSize = 30; // Nếu có 4+ chữ số
            } else if (valueStr.length == 3) {
                fontSize = 30; // Nếu có 3 chữ số
            } else if (valueStr.length == 4) {
              fontSize = 30; // Nếu có 3 chữ số
          }
            
            // Vẽ số lượng ở giữa phần bao bọc
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = '#FFFFFF'; // Màu trắng
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(valueStr, quantityX + quantitySize/2, quantityY + quantitySize/2);
        });
    }
    
    // Tạo ảnh mới từ canvas
    const newImage = new Image();
    newImage.src = canvas.toDataURL('image/png');
    await new Promise(resolve => newImage.onload = resolve);
    
    return newImage;
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
}

// Đóng modal khi bấm nút close hoặc click ra ngoài
function setupModalEvents() {
  const modal = document.getElementById('imageModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const modalImg = document.getElementById('modalImage');

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
      if (modalImg) modalImg.src = '';
    };
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
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
    // Đã bỏ đoạn gán sự kiện đóng popup hướng dẫn sử dụng ở đây để tránh trùng lặp
});

function setupGuideModalEvents() {
  const guideModal = document.getElementById('guideModal');
  const closeGuideBtn = document.getElementById('closeGuideBtn');
  const openGuideBtn = document.getElementById('openGuideBtn');

  if (closeGuideBtn) {
    closeGuideBtn.onclick = () => {
      guideModal.classList.add('hidden');
    };
  }
  if (openGuideBtn) {
    openGuideBtn.onclick = () => {
      guideModal.classList.remove('hidden');
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
    guideModal.classList.remove('hidden');
  }
}

// --- SKIN LIBRARY POPUP LOGIC ---
import skinImageList from './imgData.js';

let selectedSkinImages = [];

function renderSkinLibraryGrid(filter = '') {
  const grid = document.getElementById('skinLibraryGrid');
  grid.innerHTML = '';
  const filterLower = filter.trim().toLowerCase();
  const filteredList = skinImageList.filter(img => img.name.toLowerCase().includes(filterLower));
  filteredList.forEach((img, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'relative flex flex-col items-center border rounded p-1 cursor-pointer group transition-all duration-200 hover:shadow-lg hover:scale-105';
    wrap.dataset.url = img.url;
    wrap.dataset.name = img.name;
    // Ảnh lazy load
    const image = document.createElement('img');
    image.className = 'lazy rounded shadow border w-24 h-30 object-top mb-1 transition-transform duration-200';
    image.setAttribute('data-src', img.url);
    image.setAttribute('alt', img.name);
    // Check đã chọn
    const selectedIdx = selectedSkinImages.findIndex(sel => sel.url === img.url);
    const isSelected = selectedIdx > -1;
    if (isSelected) {
      wrap.classList.add('ring-4', 'ring-blue-500', 'bg-blue-50');
    }
    // Tên ảnh
    const label = document.createElement('span');
    label.className = 'text-xs text-center truncate w-full';
    label.textContent = img.name;
    // Overlay tick khi chọn
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
    overlay.innerHTML = isSelected ? '<span class="block text-3xl text-blue-600 font-bold drop-shadow">✔️</span>' : '';
    wrap.appendChild(image);
    wrap.appendChild(label);
    wrap.appendChild(overlay);
    // Badge số thứ tự nếu đã chọn
    let orderBadge = null;
    if (isSelected) {
      orderBadge = document.createElement('div');
      orderBadge.className = 'absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow';
      orderBadge.textContent = (selectedIdx + 1).toString();
      wrap.appendChild(orderBadge);
    }
    // Click chọn/bỏ chọn (không render lại toàn grid)
    wrap.onclick = () => {
      const idx = selectedSkinImages.findIndex(sel => sel.url === img.url);
      if (idx > -1) {
        selectedSkinImages.splice(idx, 1);
        wrap.classList.remove('ring-4', 'ring-blue-500', 'bg-blue-50');
        overlay.innerHTML = '';
        if (orderBadge) orderBadge.remove();
        // Cập nhật lại badge số thứ tự cho các ảnh còn lại trong grid
        updateSkinOrderBadgesInGrid();
      } else {
        selectedSkinImages.push(img);
        wrap.classList.add('ring-4', 'ring-blue-500', 'bg-blue-50');
        overlay.innerHTML = '<span class="block text-3xl text-blue-600 font-bold drop-shadow">✔️</span>';
        // Thêm badge số thứ tự
        const badge = document.createElement('div');
        badge.className = 'absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow';
        badge.textContent = selectedSkinImages.length.toString();
        wrap.appendChild(badge);
        // Cập nhật lại badge số thứ tự cho các ảnh còn lại trong grid
        updateSkinOrderBadgesInGrid();
      }
      updateSelectedSkinCount();
      updateConfirmSkinBtnState();
    };
    grid.appendChild(wrap);
  });
  // Khởi tạo lại lazyload
  if (window.LazyLoad) new window.LazyLoad({ elements_selector: '.lazy' });
  // Hiển thị số lượng skin đã chọn ở góc popup
  updateSelectedSkinCount();
}

// Hàm cập nhật lại badge số thứ tự cho các ảnh đã chọn trong grid mà không render lại toàn bộ grid
function updateSkinOrderBadgesInGrid() {
  const grid = document.getElementById('skinLibraryGrid');
  if (!grid) return;
  // Duyệt qua tất cả các phần tử con của grid
  Array.from(grid.children).forEach(wrap => {
    const url = wrap.dataset.url;
    const idx = selectedSkinImages.findIndex(sel => sel.url === url);
    let badge = wrap.querySelector('.absolute.top-1.left-1.bg-blue-600');
    if (idx > -1) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow';
        wrap.appendChild(badge);
      }
      badge.textContent = (idx + 1).toString();
      wrap.classList.add('ring-4', 'ring-blue-500', 'bg-blue-50');
    } else {
      if (badge) badge.remove();
      wrap.classList.remove('ring-4', 'ring-blue-500', 'bg-blue-50');
    }
  });
}

function updateSelectedSkinCount() {
  // Hiển thị số lượng skin đã chọn ở góc popup
  const countEl = document.getElementById('selectedSkinCount');
  if (countEl) countEl.textContent = selectedSkinImages.length;
  // Nếu có popup, hiển thị số lượng ở góc phải trên, đảm bảo nằm trong popup
  const popup = document.getElementById('skinLibraryModal');
  if (popup) {
    let badge = popup.querySelector('.selected-skin-count-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'selected-skin-count-badge fixed md:absolute top-4 right-6 md:top-2 md:right-4 bg-blue-600 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow z-50';
      // Đảm bảo badge là con trực tiếp của popup để không bị lệch ra ngoài
      popup.appendChild(badge);
    }
    badge.textContent = selectedSkinImages.length;
    badge.style.display = selectedSkinImages.length > 0 ? 'flex' : 'none';
  }
}
function updateConfirmSkinBtnState() {
  const btn = document.getElementById('confirmSkinSelectionBtn');
  if (btn) btn.disabled = selectedSkinImages.length === 0;
}

// Mở popup
const openSkinLibraryBtn = document.getElementById('openSkinLibraryBtn');
const skinLibraryModal = document.getElementById('skinLibraryModal');
const closeSkinLibraryBtn = document.getElementById('closeSkinLibraryBtn');
const skinLibrarySearch = document.getElementById('skinLibrarySearch');
const confirmSkinSelectionBtn = document.getElementById('confirmSkinSelectionBtn');

if (openSkinLibraryBtn && skinLibraryModal) {
  openSkinLibraryBtn.onclick = () => {
    skinLibraryModal.classList.remove('hidden');
    renderSkinLibraryGrid();
    skinLibrarySearch.value = '';
    updateConfirmSkinBtnState();
  };
}
if (closeSkinLibraryBtn && skinLibraryModal) {
  closeSkinLibraryBtn.onclick = () => {
    skinLibraryModal.classList.add('hidden');
  };
}
// Debounce cho tìm kiếm skin
let skinSearchDebounceTimeout = null;
if (skinLibrarySearch) {
  skinLibrarySearch.oninput = (e) => {
    if (skinSearchDebounceTimeout) clearTimeout(skinSearchDebounceTimeout);
    skinSearchDebounceTimeout = setTimeout(() => {
      renderSkinLibraryGrid(e.target.value);
      updateConfirmSkinBtnState();
    }, 400);
  };
}
// --- HIỂN THỊ DANH SÁCH ẢNH SKIN ĐÃ CHỌN VỚI HIỆU ỨNG ---
function renderSelectedSkinPreviewAnimated() {
  const containerId = 'selectedSkinPreviewContainer';
  let container = document.getElementById(containerId);
  if (!container) {
    const parent = document.getElementById('openSkinLibraryBtn').parentElement;
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'flex flex-wrap gap-2 mt-2';
    parent.appendChild(container);
  }
  container.innerHTML = '';
  container.style.display = selectedSkinImages.length > 0 ? 'flex' : 'none';
  // Hiệu ứng xuất hiện lần lượt từng ảnh
  selectedSkinImages.forEach((img, idx) => {
    setTimeout(() => {
      const wrap = document.createElement('div');
      wrap.className = 'relative flex flex-col items-center border rounded p-1 bg-white shadow opacity-0 transition-opacity duration-300';
      // Ảnh
      const image = document.createElement('img');
      image.src = img.url;
      image.alt = img.name;
      image.className = 'w-16 h-16 object-top rounded';
      // Tên ảnh
      const label = document.createElement('span');
      label.className = 'text-xs text-center truncate w-16';
      label.textContent = img.name;
      // Nút X
      const removeBtn = document.createElement('button');
      removeBtn.className = 'absolute -top-2 -right-2 bg-red-100 hover:bg-red-500 text-red-700 hover:text-white border border-red-300 rounded-full w-5 h-5 flex items-center justify-center shadow';
      removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        // Xóa khỏi selectedSkinImages
        const removeIdx = selectedSkinImages.findIndex(sel => sel.url === img.url);
        if (removeIdx > -1) selectedSkinImages.splice(removeIdx, 1);
        // Xóa node DOM này khỏi container, không render lại toàn bộ
        wrap.remove();
        updateSelectedSkinCount();
        updateConfirmSkinBtnState();
        // Không gọi lại renderSelectedSkinPreviewAnimated()
      };
      wrap.appendChild(image);
      wrap.appendChild(label);
      wrap.appendChild(removeBtn);
      container.appendChild(wrap);
      setTimeout(() => { wrap.style.opacity = '1'; }, 10);
    }, idx * 100);
  });
}
// Sửa sự kiện xác nhận chọn skin để render preview có hiệu ứng
if (typeof confirmSkinSelectionBtn !== 'undefined' && confirmSkinSelectionBtn && skinLibraryModal) {
  confirmSkinSelectionBtn.onclick = () => {
    skinLibraryModal.classList.add('hidden');
    updateSelectedSkinCount();
    updateConfirmSkinBtnState();
    renderSelectedSkinPreviewAnimated();
  };
}
window.processAndShowCroppedImages = processAndShowCroppedImages;
window.combineImages = combineImages;

// Thay đổi sự kiện nút Ghép Ảnh (Bước 5)
const combineBtn = document.querySelector('button[onclick="combineImages()"]');
if (combineBtn) {
  combineBtn.onclick = showCombineDemoModal;
}

// Hàm mở popup demo kéo thả
function showCombineDemoModal() {
  // Ẩn modal ảnh ghép nếu đang mở
  const imageModal = document.getElementById('imageModal');
  if (imageModal) imageModal.style.display = 'none';
  // Hiện popup demo
  const demoModal = document.getElementById('combineDemoModal');
  if (demoModal) demoModal.classList.remove('hidden');
  renderCombineDemoGrid();
}

// Đóng popup demo
const closeCombineDemoBtn = document.getElementById('closeCombineDemoBtn');
if (closeCombineDemoBtn) {
  closeCombineDemoBtn.onclick = () => {
    const demoModal = document.getElementById('combineDemoModal');
    if (demoModal) demoModal.classList.add('hidden');
  };
}

// Xác nhận ghép ảnh thật
const confirmCombineBtn = document.getElementById('confirmCombineBtn');
if (confirmCombineBtn) {
  confirmCombineBtn.onclick = () => {
    const demoModal = document.getElementById('combineDemoModal');
    if (demoModal) demoModal.classList.add('hidden');
    combineImages();
  };
}

// Render grid demo kéo thả với bố cục giống ảnh ghép thật (profile + skin)
async function renderCombineDemoGrid() {
  const grid = document.getElementById('combineDemoGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  // Lấy giá trị các item
  const gtsValue = parseInt(document.getElementById('gts').value) || 0;
  const gsValue = parseInt(document.getElementById('gs').value) || 0;
  const dtkValue = parseInt(document.getElementById('dtk').value) || 0;
  const tdtValue = parseInt(document.getElementById('tdt').value) || 0;
  const qhValue = parseInt(document.getElementById('qh').value) || 0;

  // Tạo danh sách items có giá trị được nhập
  const items = [];
  if (gtsValue > 0) items.push({name: 'Giấy tuyệt sắc', value: gtsValue, color: '#FF6B6B'});
  if (gsValue > 0) items.push({name: 'Giấy S', value: gsValue, color: '#4ECDC4'});
  if (dtkValue > 0) items.push({name: 'Đá thời không', value: dtkValue, color: '#45B7D1'});
  if (tdtValue >0) items.push({name: 'Thẻ đổi tên', value: tdtValue, color: '#FFD93D'}); // Kiểm tra text không rỗng
  if (qhValue > 0) items.push({name: 'Quân huy', value: qhValue, color: '#6C5CE7'});

  // Tạo ảnh profile mới với items bar
  let newProfileImage = croppedProfileImage;
  if (items.length > 0 && croppedProfileImage) {
    newProfileImage = await createProfileWithItems(croppedProfileImage, items);
  }

  // Lấy số cột/hàng
  const cols = parseInt(document.getElementById('combineCols').value) || 4;
  const rows = parseInt(document.getElementById('combineRows').value) || 4;
  const totalRows = rows + 1; // Tổng số hàng = combineRows + 1
  
  // Tính toán số lượng ảnh skin cần cho layout
  // Hàng 1: cols ảnh skin
  // Hàng 2: 2x2 profile + (cols-2)*2 ảnh skin
  // Hàng 3+: cols* (totalRows-2) ảnh skin
  const skinSlots = [];
  // Hàng 1
  for (let i = 0; i < cols; i++) skinSlots.push({row: 1, col: i+1});
  // Hàng 2 (bỏ 2 ô đầu cho profile)
  for (let i = 2; i < cols; i++) skinSlots.push({row: 2, col: i+1});
  // Hàng 3 (bỏ 2 ô đầu cho profile)
  for (let i = 2; i < cols; i++) skinSlots.push({row: 3, col: i+1});
  // Hàng 4+ (full hàng)
  for (let r = 4; r <= totalRows; r++) for (let c = 1; c <= cols; c++) skinSlots.push({row: r, col: c});
  
  // Lấy đúng số ảnh skin sẽ dùng
  const demoImages = selectedSkinImages.slice(0, skinSlots.length);
  
  // Tính toán kích thước ảnh để vừa với popup
  const popupContainer = document.getElementById('combineDemoModal');
  const popupWidth = popupContainer ? popupContainer.offsetWidth * 0.8 : 800; // 80% chiều rộng popup
  const popupHeight = popupContainer ? popupContainer.offsetHeight * 0.7 : 600; // 70% chiều cao popup
  const gap = 12; // Khoảng cách giữa các ảnh
  
  // Tính toán kích thước ảnh tối đa có thể
  const maxImageWidth = (popupWidth - (cols + 1) * gap) / cols;
  const maxImageHeight = (popupHeight - (totalRows + 1) * gap) / totalRows;
  
  // Chọn kích thước nhỏ hơn để đảm bảo vừa cả chiều rộng và chiều cao
  const imageSize = Math.min(maxImageWidth, maxImageHeight, 100); // Giới hạn tối đa 100px
  
  console.log('Grid size calculation:', {
    cols, totalRows, popupWidth, popupHeight,
    maxImageWidth, maxImageHeight, imageSize
  });
  
  // Tạo grid container
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, ${imageSize}px)`;
  grid.style.gridTemplateRows = `repeat(${totalRows}, ${imageSize}px)`;
  grid.style.gap = `${gap}px`;
  grid.style.justifyContent = 'center';
  grid.style.alignItems = 'center';
  
  // Render profile (chiếm 2x2) - sử dụng ảnh profile mới
  const profileImg = document.createElement('img');
  if (newProfileImage && newProfileImage.src) {
    profileImg.src = newProfileImage.src;
  } else if (croppedProfileImage && croppedProfileImage.src) {
    profileImg.src = croppedProfileImage.src;
  } else {
    profileImg.src = 'profile.png'; // fallback
  }
  profileImg.className = 'object-cover rounded border shadow bg-white';
  profileImg.style.width = '100%';
  profileImg.style.height = '100%';
  profileImg.style.objectFit = 'contain';
  profileImg.style.gridRow = '2 / span 2';
  profileImg.style.gridColumn = '1 / span 2';
  profileImg.draggable = false;
  grid.appendChild(profileImg);
  
  // Render các ảnh skin vào đúng slot
  demoImages.forEach((img, idx) => {
    const slot = skinSlots[idx];
    const imgEl = document.createElement('img');
    imgEl.src = img.url;
    imgEl.className = 'object-cover rounded border shadow bg-white cursor-move';
    imgEl.style.width = '100%';
    imgEl.style.height = '100%';
    imgEl.style.objectFit = 'contain';
    imgEl.style.gridRow = slot.row;
    imgEl.style.gridColumn = slot.col;
    imgEl.draggable = true;
    imgEl.dataset.idx = idx;
    
    // Drag events
    imgEl.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', idx);
      imgEl.classList.add('opacity-50');
    };
    imgEl.ondragend = () => {
      imgEl.classList.remove('opacity-50');
    };
    imgEl.ondragover = (e) => e.preventDefault();
    imgEl.ondrop = (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = parseInt(imgEl.dataset.idx);
      if (fromIdx !== toIdx) {
        // Hoán đổi vị trí trong demoImages
        [demoImages[fromIdx], demoImages[toIdx]] = [demoImages[toIdx], demoImages[fromIdx]];
        // Đồng bộ lại selectedSkinImages theo demoImages
        for (let i = 0; i < demoImages.length; i++) {
          const idxInAll = selectedSkinImages.findIndex(s => s.url === demoImages[i].url);
          if (idxInAll !== i) {
            [selectedSkinImages[i], selectedSkinImages[idxInAll]] = [selectedSkinImages[idxInAll], selectedSkinImages[i]];
          }
        }
        renderCombineDemoGrid();
      }
    };
    grid.appendChild(imgEl);
  });
}