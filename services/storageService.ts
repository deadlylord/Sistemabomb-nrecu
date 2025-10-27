
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// Moved from constants.ts to keep storage-related logic together
export const compressImage = (file: File, qualityLevel: 'high' | 'medium' | 'low' | 'logo' | 'background' = 'medium'): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Handle SVG separately (no compression)
    if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (event?.target?.result) {
                resolve(event.target.result as string);
            } else {
                reject(new Error('Failed to read SVG file.'));
            }
        };
        reader.onerror = (error) => reject(error);
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event?.target?.result as string;
      img.onload = () => {
        let maxSize: number;
        let quality: number;

        switch (qualityLevel) {
            case 'low':
                maxSize = 400;
                quality = 0.5;
                break;
            case 'high':
                maxSize = 1280;
                quality = 0.8;
                break;
            case 'logo':
                maxSize = 400;
                quality = 0.9;
                break;
            case 'background':
                maxSize = 1280;
                quality = 0.7;
                break;
            case 'medium':
            default:
                maxSize = 800;
                quality = 0.7;
        }
        
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Helper to convert data URL to Blob
const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

export const uploadImageAndGetURL = (imageFile: File, qualityLevel: 'high' | 'medium' | 'low' = 'medium'): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Compress the image
      const compressedDataUrl = await compressImage(imageFile, qualityLevel);
      
      // 2. Convert to Blob
      const blob = dataURLtoBlob(compressedDataUrl);

      // 3. Create a storage reference
      const storageRef = ref(storage, `product_images/${Date.now()}-${imageFile.name}`);
      
      // 4. Start the upload task
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // 5. Listen for state changes, errors, and completion of the upload.
      uploadTask.on('state_changed', 
        (snapshot) => {
          // Observe state change events such as progress, pause, and resume
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        }, 
        (error: any) => {
          // Handle unsuccessful uploads
          console.error("Error en la subida:", error);
          
          switch (error.code) {
            case 'storage/unauthorized':
              alert("Error de permisos. Asegúrate de que las reglas de Firebase Storage permitan la escritura. Contacta al administrador.");
              reject(new Error("Permission error: Check Firebase Storage security rules."));
              break;
            case 'storage/canceled':
              alert("La subida de la imagen fue cancelada.");
              reject(new Error("Upload canceled."));
              break;
            case 'storage/retry-limit-exceeded':
              alert("Error de conexión al subir la imagen. La causa más común es una configuración incorrecta de CORS en Firebase Storage. Contacta al administrador para que verifique que el bucket de almacenamiento permite solicitudes desde este dominio.");
              reject(new Error("Connection timeout (retry-limit-exceeded), likely a CORS issue."));
              break;
            case 'storage/unknown':
              alert("Error desconocido, posiblemente de CORS. Contacta al administrador para verificar la configuración del bucket de almacenamiento.");
              reject(new Error("Unknown error, possibly CORS. Check bucket configuration."));
              break;
            default:
              alert(`Ocurrió un error al subir la imagen. Código: ${error.code}`);
              reject(new Error(`Failed to upload image with code: ${error.code}`));
          }
        }, 
        () => {
          // Handle successful uploads on complete
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          }).catch((err) => {
             console.error("Error obteniendo la URL de descarga:", err);
             alert("La imagen se subió pero no se pudo obtener la URL.");
             reject(new Error("Could not get download URL after upload."));
          });
        }
      );
    } catch (error) {
      console.error("Error preparando la imagen:", error);
      alert("Hubo un error al procesar la imagen antes de subirla.");
      reject(new Error("Failed to process image before upload."));
    }
  });
};


export const reuploadImageFromUrl = async (imageUrl: string, qualityLevel: 'high' | 'medium' | 'low'): Promise<string> => {
    // NOTE: For this to work, the Firebase Storage bucket must have CORS configured
    // to allow GET requests from the application's domain.
    // If it fails, a proxy is used as a fallback.
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image directly: ${response.statusText}`);
        }
        const blob = await response.blob();
        const imageFile = new File([blob], `recompressed-${Date.now()}.jpg`, { type: blob.type });

        // The existing uploadImageAndGetURL function handles both compression and upload
        return await uploadImageAndGetURL(imageFile, qualityLevel);
    } catch (error) {
        console.error(`Direct fetch failed for ${imageUrl}, trying proxy. Error:`, error);
        // This proxy is a public fallback and not recommended for production. 
        // The best solution is to configure CORS on the Firebase Storage bucket.
        const proxyUrl = 'https://corsproxy.io/?';
        const response = await fetch(proxyUrl + encodeURIComponent(imageUrl));
         if (!response.ok) {
            throw new Error(`Failed to fetch image via proxy: ${response.statusText}`);
        }
        const blob = await response.blob();
        const imageFile = new File([blob], `recompressed-${Date.now()}.jpg`, { type: blob.type });
        return await uploadImageAndGetURL(imageFile, qualityLevel);
    }
};
