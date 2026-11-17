//! Wire format shared by every worker process. Each message is one frame:
//! `[u32 json_len][json][u32 payload_len][payload bytes]` (lengths
//! little-endian, payload as little-endian f32: PCM going to a speech worker,
//! audio coming back from a voice worker, empty for everything else). JSON
//! (not bincode) is deliberate: transcribe-cpp's serde impls round-trip NaN
//! confidences through `null`, which only works with a self-describing format.

use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};

/// Refuse frames larger than this: a garbage length must not turn into a
/// multi-gigabyte allocation. One hour of 16 kHz f32 PCM is ~230 MB.
pub const MAX_SECTION_BYTES: usize = 1 << 30;

/// Encode one frame. Refuses a section the reader would refuse, so an
/// oversized message fails cleanly here instead of killing the worker.
pub fn encode_message<T: Serialize>(message: &T, payload: Option<&[f32]>) -> io::Result<Vec<u8>> {
    let json = serde_json::to_vec(message).map_err(io::Error::other)?;
    check_section_len(json.len())?;
    let payload = payload.unwrap_or(&[]);
    check_section_len(payload.len() * 4)?;
    let mut frame = Vec::with_capacity(8 + json.len() + payload.len() * 4);
    frame.extend_from_slice(&(json.len() as u32).to_le_bytes());
    frame.extend_from_slice(&json);
    frame.extend_from_slice(&((payload.len() * 4) as u32).to_le_bytes());
    for sample in payload {
        frame.extend_from_slice(&sample.to_le_bytes());
    }
    Ok(frame)
}

pub fn write_message<T: Serialize>(
    w: &mut impl Write,
    message: &T,
    payload: Option<&[f32]>,
) -> io::Result<()> {
    w.write_all(&encode_message(message, payload)?)?;
    w.flush()
}

/// Read one frame. `Ok(None)` only on a clean EOF before the first byte of a
/// frame; a frame cut off part-way is an error.
pub fn read_message<T: for<'de> Deserialize<'de>>(
    r: &mut impl Read,
) -> io::Result<Option<(T, Vec<f32>)>> {
    let mut len = [0u8; 4];
    let mut filled = 0;
    while filled < len.len() {
        match r.read(&mut len[filled..]) {
            Ok(0) if filled == 0 => return Ok(None),
            Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
            Ok(n) => filled += n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e),
        }
    }
    let json = read_section_body(r, len)?;
    let message = serde_json::from_slice(&json).map_err(io::Error::other)?;
    let payload_bytes = read_section(r)?;
    if payload_bytes.len() % 4 != 0 {
        return Err(io::Error::other(
            "payload section is not a whole number of f32s",
        ));
    }
    let payload = payload_bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|b| f32::from_le_bytes(*b))
        .collect();
    Ok(Some((message, payload)))
}

fn read_section(r: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut len = [0u8; 4];
    r.read_exact(&mut len)?;
    read_section_body(r, len)
}

fn read_section_body(r: &mut impl Read, len: [u8; 4]) -> io::Result<Vec<u8>> {
    let len = u32::from_le_bytes(len) as usize;
    check_section_len(len)?;
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)?;
    Ok(buf)
}

/// Also keeps every section length within the frame's `u32` length prefix.
pub fn check_section_len(len: usize) -> io::Result<()> {
    if len > MAX_SECTION_BYTES {
        return Err(io::Error::other(format!("frame section too large: {len}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    enum Message {
        Speak { text: String },
        Done,
    }

    #[test]
    fn round_trips_message_with_payload() {
        let mut buf = Vec::new();
        let payload = [0.0f32, -1.0, 0.5, f32::MIN_POSITIVE];
        let message = Message::Speak { text: "hi".into() };
        write_message(&mut buf, &message, Some(&payload)).unwrap();
        write_message(&mut buf, &Message::Done, None).unwrap();
        let mut reader = buf.as_slice();
        let (got, samples): (Message, Vec<f32>) = read_message(&mut reader).unwrap().unwrap();
        assert_eq!(got, message);
        assert_eq!(samples, payload);
        let (got, samples): (Message, Vec<f32>) = read_message(&mut reader).unwrap().unwrap();
        assert_eq!(got, Message::Done);
        assert!(samples.is_empty());
        assert!(read_message::<Message>(&mut reader).unwrap().is_none());
    }

    #[test]
    fn truncated_frame_is_an_error() {
        let mut buf = Vec::new();
        write_message(&mut buf, &Message::Done, Some(&[0.5f32; 8])).unwrap();
        for cut in [1, 3, 6, buf.len() - 1] {
            let partial = &buf[..cut];
            let err = read_message::<Message>(&mut &*partial).unwrap_err();
            assert_eq!(err.kind(), io::ErrorKind::UnexpectedEof, "cut at {cut}");
        }
    }

    #[test]
    fn section_limit_is_inclusive_and_fits_the_length_prefix() {
        assert!(check_section_len(MAX_SECTION_BYTES).is_ok());
        assert!(check_section_len(MAX_SECTION_BYTES + 1).is_err());
        assert!(MAX_SECTION_BYTES <= u32::MAX as usize);
    }
}
