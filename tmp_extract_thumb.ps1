Add-Type -AssemblyName System.Drawing
$code = @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct SIZE { public int cx; public int cy; }

[Flags]
public enum SIIGBF {
    RESIZETOFIT = 0x0,
    BIGGERSIZEOK = 0x1,
    MEMORYONLY = 0x2,
    ICONONLY = 0x4,
    THUMBNAILONLY = 0x8,
    INCACHEONLY = 0x10
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
interface IShellItemImageFactory {
    void GetImage(SIZE size, SIIGBF flags, out IntPtr phbm);
}

public static class NativeThumbnail {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(string pszPath, IntPtr pbc, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);

    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr hObject);

    public static void SaveThumbnail(string input, string output, int width, int height) {
        Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
        IShellItemImageFactory factory;
        SHCreateItemFromParsingName(input, IntPtr.Zero, ref iid, out factory);
        SIZE size; size.cx = width; size.cy = height;
        IntPtr hBitmap;
        factory.GetImage(size, SIIGBF.BIGGERSIZEOK | SIIGBF.THUMBNAILONLY, out hBitmap);
        using (var bmp = Image.FromHbitmap(hBitmap)) {
            bmp.Save(output, System.Drawing.Imaging.ImageFormat.Png);
        }
        DeleteObject(hBitmap);
    }
}
"@
Add-Type -TypeDefinition $code
$in='e:\soft\xwechat_files\wxid_9dirv0jrrbi822_9ab4\msg\file\2026-04\wuhenAI-API\wuhenAI-API\meeting_02.mp4'
$out='e:\soft\xwechat_files\wxid_9dirv0jrrbi822_9ab4\msg\file\2026-04\wuhenAI-API\wuhenAI-API\meeting_02_thumb.png'
[NativeThumbnail]::SaveThumbnail($in,$out,1280,720)
Write-Host $out
