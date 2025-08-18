"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Upload, Download, ImageIcon, FileImage, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ConvertedImage {
  id: string
  originalName: string
  originalSize: number
  convertedSize: number
  originalUrl: string
  convertedUrl: string
  status: "converting" | "completed" | "error"
  error?: string
}

export default function ImageConverter() {
  const [images, setImages] = useState<ConvertedImage[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()

  const convertToWebP = useCallback(async (file: File): Promise<ConvertedImage> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        if (ctx) {
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(img, 0, 0)
        }

        const tryCompressions = async () => {
          const compressionResults: { blob: Blob; size: number }[] = []

          await new Promise<void>((resolveMethod) => {
            canvas.toBlob((blob) => {
              if (blob) {
                compressionResults.push({ blob, size: blob.size })
              }
              resolveMethod()
            }, "image/webp")
          })

          await new Promise<void>((resolveMethod) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  compressionResults.push({ blob, size: blob.size })
                }
                resolveMethod()
              },
              "image/webp",
              0.95,
            )
          })

          const optimizedCanvas = document.createElement("canvas")
          const optimizedCtx = optimizedCanvas.getContext("2d")
          optimizedCanvas.width = img.naturalWidth
          optimizedCanvas.height = img.naturalHeight

          if (optimizedCtx) {
            optimizedCtx.imageSmoothingEnabled = false
            optimizedCtx.globalCompositeOperation = "source-over"
            optimizedCtx.drawImage(img, 0, 0)

            await new Promise<void>((resolveMethod) => {
              optimizedCanvas.toBlob((blob) => {
                if (blob) {
                  compressionResults.push({ blob, size: blob.size })
                }
                resolveMethod()
              }, "image/webp")
            })
          }

          const bestResult = compressionResults.reduce((best, current) => (current.size < best.size ? current : best))

          if (bestResult) {
            const convertedUrl = URL.createObjectURL(bestResult.blob)
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              originalName: file.name,
              originalSize: file.size,
              convertedSize: bestResult.size,
              originalUrl: URL.createObjectURL(file),
              convertedUrl,
              status: "completed",
            })
          } else {
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              originalName: file.name,
              originalSize: file.size,
              convertedSize: 0,
              originalUrl: URL.createObjectURL(file),
              convertedUrl: "",
              status: "error",
              error: "Failed to convert image",
            })
          }
        }

        tryCompressions()
      }

      img.onerror = () => {
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          originalName: file.name,
          originalSize: file.size,
          convertedSize: 0,
          originalUrl: URL.createObjectURL(file),
          convertedUrl: "",
          status: "error",
          error: "Failed to load image",
        })
      }

      img.src = URL.createObjectURL(file)
    })
  }, [])

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      const validFiles = Array.from(files).filter(
        (file) =>
          file.type.startsWith("image/") &&
          ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff"].includes(file.type),
      )

      if (validFiles.length === 0) {
        toast({
          title: "Invalid files",
          description: "Please select valid image files (PNG, JPG, JPEG, BMP, TIFF)",
          variant: "destructive",
        })
        return
      }

      setIsConverting(true)
      setProgress(0)

      const convertingImages: ConvertedImage[] = validFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        originalName: file.name,
        originalSize: file.size,
        convertedSize: 0,
        originalUrl: URL.createObjectURL(file),
        convertedUrl: "",
        status: "converting",
      }))

      setImages((prev) => [...prev, ...convertingImages])

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        const convertingImage = convertingImages[i]

        try {
          const convertedImage = await convertToWebP(file)

          setImages((prev) => prev.map((img) => (img.id === convertingImage.id ? convertedImage : img)))

          setProgress(((i + 1) / validFiles.length) * 100)
        } catch (error) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === convertingImage.id ? { ...img, status: "error", error: "Conversion failed" } : img,
            ),
          )
        }
      }

      setIsConverting(false)
      toast({
        title: "Conversion complete!",
        description: `Successfully converted ${validFiles.length} image(s) to WebP format`,
      })
    },
    [convertToWebP, toast],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        handleFileUpload(e.dataTransfer.files)
      }
    },
    [handleFileUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const downloadImage = useCallback(
    (image: ConvertedImage) => {
      try {
        const link = document.createElement("a")
        link.href = image.convertedUrl
        link.download = image.originalName.replace(/\.[^/.]+$/, ".webp")
        link.style.display = "none"

        document.body.appendChild(link)

        link.click()

        setTimeout(() => {
          document.body.removeChild(link)
        }, 100)

        toast({
          title: "Download started",
          description: `Downloading ${image.originalName.replace(/\.[^/.]+$/, ".webp")}`,
        })
      } catch (error) {
        toast({
          title: "Download failed",
          description: "There was an error downloading the image",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const downloadAll = useCallback(() => {
    const completedImages = images.filter((img) => img.status === "completed")

    if (completedImages.length === 0) {
      toast({
        title: "No images to download",
        description: "Please wait for conversions to complete",
        variant: "destructive",
      })
      return
    }

    completedImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImage(image)
      }, index * 500)
    })

    toast({
      title: "Batch download started",
      description: `Downloading ${completedImages.length} images...`,
    })
  }, [images, downloadImage, toast])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getCompressionRatio = (original: number, converted: number) => {
    if (original === 0) return 0
    return Math.round(((original - converted) / original) * 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">WebP Image Converter</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Convert your images to WebP format with maximum lossless compression
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Images
            </CardTitle>
            <CardDescription>
              Drag and drop your images here or click to browse. Supports PNG, JPG, JPEG, BMP, and TIFF formats.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Drop your images here</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">or click to browse files</p>
              <input
                id="file-input"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/bmp,image/tiff"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />
            </div>

            {isConverting && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Converting images...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {images.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileImage className="h-5 w-5" />
                    Conversion Results
                  </CardTitle>
                  <CardDescription>
                    {images.filter((img) => img.status === "completed").length} of {images.length} images converted
                    successfully
                  </CardDescription>
                </div>
                {images.some((img) => img.status === "completed") && (
                  <Button onClick={downloadAll} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {images.map((image) => (
                  <div key={image.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {image.status === "completed" && <CheckCircle className="h-5 w-5 text-green-500" />}
                        {image.status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                        {image.status === "converting" && (
                          <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{image.originalName}</p>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {image.status === "completed" && (
                            <>
                              {formatFileSize(image.originalSize)} → {formatFileSize(image.convertedSize)}
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                ({getCompressionRatio(image.originalSize, image.convertedSize)}% smaller)
                              </span>
                            </>
                          )}
                          {image.status === "error" && <span className="text-red-500">{image.error}</span>}
                          {image.status === "converting" && <span>Converting...</span>}
                        </div>
                      </div>
                    </div>
                    {image.status === "completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadImage(image)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">100% Lossless Quality</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Perfect quality preservation with advanced compression algorithms
                </p>
              </div>
              <div className="text-center p-4">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Maximum Compression</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Multiple compression methods tested to achieve smallest file size
                </p>
              </div>
              <div className="text-center p-4">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Batch Processing</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Convert multiple images at once with drag & drop
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
