import React, { useState, useEffect, useRef } from 'react'
import { Search, MapPin } from 'lucide-react'
import { searchAddressSuggestions, type AddressSuggestion } from '../services/address'
import { Spinner, AlertBox } from '@/components/ui-kit'
import './AddressAutocomplete.css'

interface AddressAutocompleteProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  onSelect?: (address: AddressSuggestion) => void
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value = '',
  onChange,
  placeholder = '请输入地址',
  disabled = false,
  onSelect,
}) => {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const justSelectedRef = useRef(false)
  const isUserTypingRef = useRef(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  // 防抖搜索 —— 仅用户输入时触发
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    if (!isUserTypingRef.current) return
    isUserTypingRef.current = false

    const timer = setTimeout(async () => {
      if (inputValue.trim().length >= 2) {
        await searchAddress(inputValue.trim())
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue])

  // 点击外部关闭建议列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchAddress = async (query: string) => {
    if (!query) return
    setLoading(true)
    setError(null)
    try {
      const response = await searchAddressSuggestions(query, 15)
      if (response.success) {
        setSuggestions(response.suggestions)
        setShowSuggestions(response.suggestions.length > 0)
        if (response.suggestions.length === 0) {
          setError('未找到匹配的地址，请尝试输入更详细的信息（如：街道名称、门牌号、城市）')
        }
      } else {
        setError(response.error || '搜索失败')
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (err) {
      console.error('Address search error:', err)
      setError('搜索服务暂时不可用，请稍后重试')
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    isUserTypingRef.current = true
    setInputValue(newValue)
    onChange?.(newValue)
    if (newValue.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    justSelectedRef.current = true
    setInputValue(suggestion.display_name)
    setShowSuggestions(false)
    setSuggestions([])
    onChange?.(suggestion.display_name)
    onSelect?.(suggestion)
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) setShowSuggestions(true)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  return (
    <div className="address-autocomplete">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="address-input w-full text-sm bg-white border border-slate-200 rounded-lg pl-10 pr-9 py-2 text-slate-700 focus:outline-2 focus:outline-slate-900 focus:outline-offset-0 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? <Spinner className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </span>
      </div>

      {showSuggestions && (
        <div ref={suggestionsRef} className="suggestions-container">
          {error && (
            <div className="m-2"><AlertBox type="warning" title="搜索失败" description={error} /></div>
          )}

          {suggestions.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="suggestion-item flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{suggestion.display_name.split(',')[0]}</div>
                    <div className="text-xs text-slate-500 truncate">{suggestion.display_name}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {suggestions.length === 0 && !loading && inputValue.length >= 2 && (
            <div className="no-suggestions">
              <span className="block text-center text-slate-400 p-4">未找到相关地址，请尝试其他关键词</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AddressAutocomplete
