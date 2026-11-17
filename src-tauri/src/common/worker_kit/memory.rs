//! How much memory a worker process is using right now, for the Models page.

/// Memory `pid` is using right now in bytes, or `None` when it can't be read
/// (the process is gone). macOS: the physical footprint, what Activity
/// Monitor shows as Memory, which counts Metal (GPU) memory on Apple Silicon.
/// Linux: the resident set. Windows: the working set, what Task Manager shows.
pub fn process_memory(pid: u32) -> Option<u64> {
    read(pid)
}

#[cfg(target_os = "macos")]
fn read(pid: u32) -> Option<u64> {
    let mut info = std::mem::MaybeUninit::<libc::rusage_info_v2>::zeroed();
    // SAFETY: RUSAGE_INFO_V2 asks for exactly a `rusage_info_v2`, which is
    // what `info` holds; it is read only when the call succeeds.
    unsafe {
        let status = libc::proc_pid_rusage(
            pid as libc::c_int,
            libc::RUSAGE_INFO_V2,
            info.as_mut_ptr().cast::<libc::rusage_info_t>(),
        );
        (status == 0).then(|| info.assume_init().ri_phys_footprint)
    }
}

#[cfg(target_os = "linux")]
fn read(pid: u32) -> Option<u64> {
    let statm = std::fs::read_to_string(format!("/proc/{pid}/statm")).ok()?;
    let resident_pages: u64 = statm.split_whitespace().nth(1)?.parse().ok()?;
    // SAFETY: sysconf has no preconditions.
    let page_size = unsafe { libc::sysconf(libc::_SC_PAGESIZE) };
    Some(resident_pages * u64::try_from(page_size).ok()?)
}

#[cfg(windows)]
fn read(pid: u32) -> Option<u64> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    // SAFETY: the handle is closed before returning, and `cb` tells the call
    // the size of the counters it fills.
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut counters = PROCESS_MEMORY_COUNTERS {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            ..Default::default()
        };
        let read = GetProcessMemoryInfo(process, &mut counters, counters.cb);
        let _ = CloseHandle(process);
        read.ok()?;
        Some(counters.WorkingSetSize as u64)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
fn read(_pid: u32) -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    use super::process_memory;

    #[test]
    fn reads_this_process_and_not_a_missing_one() {
        if cfg!(any(target_os = "macos", target_os = "linux", windows)) {
            let bytes = process_memory(std::process::id()).expect("own memory");
            assert!(bytes > 1 << 20, "{bytes}");
        }
        // Far above any OS's pid limit, so never a live process.
        assert_eq!(process_memory(0x7FFF_FFF0), None);
    }
}
