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
const combineRowsInput = document.getElementById('combineRows');

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

document.getElementById('inputImages').addEventListener('change', async function() {
    if (!this.files.length) {
        previewImage_batch.src = '';
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        currentBatchImageOriginalWidth = 0;
        currentBatchImageOriginalHeight = 0;
        console.log("Không có ảnh hàng loạt được chọn.");
        return;
    }
    const file = this.files[0];
    const dataURL = await fileToDataURL(file);
    previewImage_batch.src = dataURL;
    previewImage_batch.onload = () => {
        currentBatchImageOriginalWidth = previewImage_batch.naturalWidth;
        currentBatchImageOriginalHeight = previewImage_batch.naturalHeight;

        const aspectRatio = currentBatchImageOriginalWidth / currentBatchImageOriginalHeight;
        let displayWidth = Math.min(CANVAS_RENDER_MAX_WIDTH, window.innerWidth - 40);
        let displayHeight = displayWidth / aspectRatio;

        previewCanvas.width = displayWidth;
        previewCanvas.height = displayHeight;
        // Thêm dòng này để đảm bảo kích thước hiển thị của canvas khớp với kích thước vẽ
        previewCanvas.style.width = `${displayWidth}px`;
        previewCanvas.style.height = `${displayHeight}px`;
        
        if (parseInt(batchCropW.value) === 0 || parseInt(batchCropH.value) === 0 || parseInt(batchCropW.value) > currentBatchImageOriginalWidth || parseInt(batchCropH.value) > currentBatchImageOriginalHeight) {
            batchCropX.value = 0;
            batchCropY.value = 0;
            batchCropW.value = Math.min(currentBatchImageOriginalWidth, 100);
            batchCropH.value = Math.min(currentBatchImageOriginalHeight, 100);
        }


        drawBatchRect = setupCanvasInteraction(previewCanvas, previewCtx, previewImage_batch, batchCropX, batchCropY, batchCropW, batchCropH, currentBatchImageOriginalWidth, currentBatchImageOriginalHeight);
        drawBatchRect("green");
        console.log("Ảnh hàng loạt preview đã tải và thiết lập vùng cắt ban đầu.");
        console.log(`Ảnh gốc Batch: ${currentBatchImageOriginalWidth}x${currentBatchImageOriginalHeight}, Canvas hiển thị: ${displayWidth}x${displayHeight}`);
    };
    previewImage_batch.onerror = () => {
        console.error("Lỗi khi tải ảnh hàng loạt preview.");
        alert("Không thể tải ảnh hàng loạt đầu tiên để hiển thị. Vui lòng kiểm tra file ảnh.");
    };
});

inputProfileImage.addEventListener('change', async function() {
    if (!this.files.length) {
        profileCanvas.src = '';
        profileCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
        currentProfileImageOriginalWidth = 0;
        currentProfileImageOriginalHeight = 0;
        croppedProfileImage = null;
        console.log("Không có ảnh profile được chọn.");
        return;
    }
    const file = this.files[0];
    const dataURL = await fileToDataURL(file);
    previewImage_profile.src = dataURL;
    previewImage_profile.onload = () => {
        currentProfileImageOriginalWidth = previewImage_profile.naturalWidth;
        currentProfileImageOriginalHeight = previewImage_profile.naturalHeight;

        const aspectRatio = currentProfileImageOriginalWidth / currentProfileImageOriginalHeight;
        let displayWidth = Math.min(CANVAS_RENDER_MAX_WIDTH, window.innerWidth - 40);
        let displayHeight = displayWidth / aspectRatio;

        profileCanvas.width = displayWidth;
        profileCanvas.height = displayHeight;
        // Thêm dòng này để đảm bảo kích thước hiển thị của canvas khớp với kích thước vẽ
        profileCanvas.style.width = `${displayWidth}px`;
        profileCanvas.style.height = `${displayHeight}px`;

        if (parseInt(profileCropW.value) === 0 || parseInt(profileCropH.value) === 0 || parseInt(profileCropW.value) > currentProfileImageOriginalWidth || parseInt(profileCropH.value) > currentProfileImageOriginalHeight) {
            profileCropX.value = 0;
            profileCropY.value = 0;
            profileCropW.value = currentProfileImageOriginalWidth;
            profileCropH.value = currentProfileImageOriginalHeight;
        }
        
        drawProfileRect = setupCanvasInteraction(profileCanvas, profileCtx, previewImage_profile, profileCropX, profileCropY, profileCropW, profileCropH, currentProfileImageOriginalWidth, currentProfileImageOriginalHeight);
        drawProfileRect("green");
        console.log("Ảnh profile preview đã tải và thiết lập vùng cắt ban đầu.");
        console.log(`Ảnh gốc Profile: ${currentProfileImageOriginalWidth}x${currentProfileImageOriginalHeight}, Canvas hiển thị: ${displayWidth}x${displayHeight}`);
    };
    previewImage_profile.onerror = () => {
        console.error("Lỗi khi tải ảnh profile preview.");
        alert("Không thể tải ảnh profile. Vui lòng kiểm tra file ảnh.");
    };
});

async function processAndShowCroppedImages() {
    finalOutputCanvas.style.display = 'none';
    document.getElementById('downloadCombinedImage').style.display = 'none';
    finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCanvas.height);

    console.log("Bắt đầu quá trình cắt ảnh...");

    // 1. Crop profile image first
    if (!previewImage_profile.src || previewImage_profile.naturalWidth === 0 || previewImage_profile.naturalHeight === 0) {
        alert("Vui lòng tải ảnh profile trước khi cắt.");
        console.error("Lỗi: Ảnh profile chưa tải.");
        return;
    }
    croppedProfileImage = await cropProfileImage();
    if (!croppedProfileImage) {
        console.error("Không thể cắt ảnh profile. Dừng quá trình.");
        return;
    }
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

    // 3. Crop batch images with the calculated target dimensions
    const cropSuccess = await cropBatchImages(inputBatchFiles, batchTargetWidth, batchTargetHeight);

    if (!cropSuccess) {
        console.error("Không thể cắt ảnh hàng loạt. Dừng quá trình.");
        return;
    }
    
    console.log("Hoàn thành quá trình cắt ảnh. Tất cả ảnh đã cắt sẵn sàng để ghép.");
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
    croppedImagesContainer.innerHTML = '';
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
                    wrap.className = 'cropped-image-wrapper';
                    wrap.dataset.fileName = fileName;
                    wrap.dataset.originalIndex = i; // Store original index if needed

                    const imgPreview = new Image();
                    imgPreview.src = croppedDataURL;
                    imgPreview.onload = () => {
                        allCroppedBatchImages.push(imgPreview); // Add to ALL cropped images
                        updateZipDownloadLink();
                        resolve();
                    };
                    imgPreview.onerror = () => {
                        console.error(`Lỗi tải ảnh preview thumbnail cho ${fileName}`);
                        resolve();
                    }
                    wrap.appendChild(imgPreview);
                    
                    const removeButton = document.createElement('button');
                    removeButton.className = 'remove-button';
                    removeButton.textContent = 'x';
                    removeButton.onclick = (e) => {
                        e.stopPropagation();
                        removeCroppedImage(wrap, fileName, imgPreview);
                    };
                    wrap.appendChild(removeButton);

                    croppedImagesContainer.appendChild(wrap);
                };
                img.onerror = () => {
                    console.error(`Lỗi tải ảnh gốc (từ dataURL) cho ${file.name}`);
                    resolve(); // Resolve to continue with next file even if this one fails
                };
                img.src = dataURL;
            });
        } catch (error) {
            console.error(`Lỗi xử lý file ${file.name}:`, error);
        }
    }
    console.log("Hoàn thành việc cắt các ảnh hàng loạt ban đầu.");
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
    // Ensure all images are fully loaded
    await Promise.all(allCroppedBatchImages.map(img => new Promise(resolve => {
        if (img.complete) {
            resolve();
        } else {
            img.onload = resolve;
            img.onerror = () => {
                console.warn(`Lỗi tải ảnh để ghép: ${img.src.substring(0, 50)}`);
                resolve(); // Resolve even on error to prevent hanging
            };
        }
    })));

    if (!croppedProfileImage || croppedProfileImage.naturalWidth === 0 || croppedProfileImage.naturalHeight === 0) {
        alert('Vui lòng cắt ảnh profile trước khi ghép. Ảnh profile có thể bị lỗi hoặc chưa tải.');
        console.error("Không có ảnh profile đã cắt hoặc kích thước không hợp lệ.");
        return;
    }
    if (allCroppedBatchImages.length === 0) {
        alert('Vui lòng cắt ít nhất một ảnh hàng loạt để ghép.');
        console.error("Không có ảnh hàng loạt nào để ghép.");
        return;
    }

    const itemsPerRow = parseInt(combineColsInput.value);
    const numRows = parseInt(combineRowsInput.value);

    if (itemsPerRow < 2) {
        alert('Số cột để ghép phải ít nhất là 2 để có chỗ cho ảnh profile và phần còn lại.');
        console.error("Lỗi: Số cột không đủ.");
        return;
    }
    if (numRows < 2) {
         alert('Số hàng để ghép phải ít nhất là 2 để có chỗ cho ảnh profile và phần còn lại.');
         console.error("Lỗi: Số hàng không đủ.");
         return;
    }


    // Lấy kích thước ảnh profile đã cắt
    const profileCroppedWidth = croppedProfileImage.naturalWidth;
    const profileCroppedHeight = croppedProfileImage.naturalHeight;
    
    // Kích thước ảnh batch target, phải dựa trên kích thước thực tế của ảnh profile
    const batchTargetWidth = Math.floor(profileCroppedWidth / 2); 
    const batchTargetHeight = Math.floor(profileCroppedHeight / 2);

    console.log(`Ghép ảnh với cấu hình: Profile (original) ${profileCroppedWidth}x${profileCroppedHeight}, Batch (target) ${batchTargetWidth}x${batchTargetHeight}`);
    console.log(`Số ảnh hàng loạt hiện có: ${allCroppedBatchImages.length}`);
    console.log(`Số cột ghép: ${itemsPerRow}, Số hàng ghép: ${numRows}`);


    await drawCombinedImage(profileCroppedWidth, profileCroppedHeight, batchTargetWidth, batchTargetHeight, allCroppedBatchImages, itemsPerRow, numRows);
}

async function drawCombinedImage(profileOriginalWidth, profileOriginalHeight, batchImageWidth, batchImageHeight, imagesToUse, itemsPerRow, numRows) {
    console.log("Bắt đầu hàm drawCombinedImage với bố cục mới.");
    console.log(`Số ảnh hàng loạt thực tế sẽ được dùng: ${imagesToUse.length}`);

    finalOutputCanvas.style.display = 'none';
    document.getElementById('downloadCombinedImage').style.display = 'none';
    finalOutputCtx.clearRect(0, 0, finalOutputCanvas.width, finalOutputCanvas.height);

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
    const zipLink = document.getElementById('downloadAll');
    if (Object.keys(croppedFilesData).length === 0) {
        zipLink.style.display = 'none';
    } else {
        zipLink.style.display = 'inline-block';
    }
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}